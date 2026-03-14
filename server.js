import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const db = await open({
  filename: "./bookings.db",
  driver: sqlite3.Database
});

await db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
phone TEXT,
date TEXT,
time TEXT,
guests INTEGER
)
`);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const restaurantData = `
Restaurant: Spice Garden
Location: Anna Nagar, Chennai
Open: 11AM - 11PM
Menu:
Veg Manchurian - 180
Chicken 65 - 220
Paneer Butter Masala - 210
Chicken Briyani - 250
Gulab Jamun - 90
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Restaurant assistant. Data: " + restaurantData },
      { role: "user", content: message }
    ]
  });

  res.json({ reply: response.choices[0].message.content });
});

app.post("/booking", async (req, res) => {
  const { name, phone, date, time, guests } = req.body;

  await db.run(
    "INSERT INTO bookings (name, phone, date, time, guests) VALUES (?,?,?,?,?)",
    [name, phone, date, time, guests]
  );

  try {
    await twilioClient.messages.create({
      body: `Booking confirmed for ${name} on ${date} at ${time} for ${guests} guests.`,
      from: process.env.TWILIO_SMS_NUMBER,
      to: phone
    });
  } catch (e) {
    console.log("SMS error:", e.message);
  }

  res.json({ success: true });
});

app.post("/whatsapp", async (req, res) => {
  const msg = req.body.Body;

  const ai = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Restaurant assistant." },
      { role: "user", content: msg }
    ]
  });

  res.send(`<Response><Message>${ai.choices[0].message.content}</Message></Response>`);
});

app.get("/admin/bookings", async (req, res) => {
  const rows = await db.all("SELECT * FROM bookings ORDER BY id DESC");
  res.json(rows);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on http://localhost:" + port);
});
