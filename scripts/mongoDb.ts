import { MongoClient } from "mongodb";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";

const {
  MONGODB_URI,
  MONGODB_COLLECTION,
  OPENAI_API_KEY,
  GOOGLE_GENAI_API_KEY,
} = process.env;

// ---- OpenAI + Google ----
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const google = new GoogleGenAI({ apiKey: GOOGLE_GENAI_API_KEY });

// ---- MongoDB ----
const client = new MongoClient(MONGODB_URI!);

// Because the DB name is inside the URI, we don't specify it here.
const db = client.db();
const collection = db.collection(MONGODB_COLLECTION);

// ---- Text splitter ----
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

// ---- URLs ----
const fileData = [
  "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup",
  "https://en.wikipedia.org/wiki/Lionel_Messi",
  "https://en.wikipedia.org/wiki/Cristiano_Ronaldo",
  "https://en.wikipedia.org/wiki/Neymar",
  "https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9",
  "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_final",
  "https://en.wikipedia.org/wiki/Football",
];

// ---- Scraper ----
async function scrapePage(url: string) {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });

  return (await loader.scrape())?.replace(/<[^>]*>?/gm, " ");
}

// ---- Main loader ----
async function loadSampleData() {
  await client.connect();
  console.log("Connected to MongoDB");

  for await (const fileUrl of fileData) {
    console.log("Scraping:", fileUrl);

    const content = await scrapePage(fileUrl);
    if (!content) continue;

    const chunks = await splitter.splitText(content);

    for await (const chunk of chunks) {
      // Generate embedding
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        encoding_format: "float",
      });

      const vector = embedding.data[0].embedding;

      // Insert into Mongo
      await collection.insertOne({
        text: chunk,
        vector,
        source: fileUrl,
      });

      console.log("Inserted chunk from", fileUrl);
    }
  }

  console.log("Done.");
}

loadSampleData().catch(console.error);
