import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { pipeline } from "@xenova/transformers";
import { LocalIndex } from 'vectra';
import multer from 'multer';
import { nodewhisper } from 'nodejs-whisper';
import { exec } from 'child_process';
import wavefile from 'wavefile';

dotenv.config();

const __dirname = path.resolve();
const app = express();
const server= http.createServer(app);

app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use(cookieParser());

// all-MiniLM-L6-v2
// all-MiniLM-L12-v2
// all-mpnet-base-v2
const extractor = await pipeline("feature-extraction","Xenova/all-mpnet-base-v2");
const index = new LocalIndex(path.join(__dirname, 'my_search_index'));
 
async function processProduct(product) {
  try {
    // Generate the vector "fingerprint"
    const output = await extractor(product.productTitle, { 
      pooling: "mean", 
      normalize: true 
    });
    
    const vector = Array.from(output.data);
    await index.insertItem({
      vector: vector,
      metadata: { 
        title: product.productTitle
      }
    });
    return product; 
  } catch (error) {
    console.error(`Error processing ${product.productTitle}:`, error);
    return null;
  }
}

const runWithConcur= async(items, limit, processProduct) =>{
  let index=0;
  async function next(){
    while(index < items.length){
      const current= index++;
      await processProduct(items[current])
    }
  }
  await Promise.all(Array.from({ length: limit }, next));

}

const initVectorDb = async () => {
  const {products}= JSON.parse(fs.readFileSync('products.json', 'utf8'));  
  if (!await index.isIndexCreated()) {
    await index.createIndex();
  }

  const BATCH_SIZE = 500;
  const CONCURRENCY_LIMIT = 20; 
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await index.beginUpdate();
    await runWithConcur(batch, CONCURRENCY_LIMIT, processProduct);
    await index.endUpdate();

    console.log(`📦 Processed ${i + batch.length} / ${products.length} products`);
  }

  console.log("✅ Local Vector DB created successfully!");
};

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// await initVectorDb();

// app.get('/search/:query', async (req, res)=>{
 
//   const qEmbedding = await extractor(req.params.query.trim(), {
//     pooling: "mean",
//     normalize: true
//   });
//   const qVector = Array.from(qEmbedding.data);
//   const results = vectorDb.map(item => ({
//       text: item.text,
//       score: cosineSimilarity(qVector, item.vector)
//     })).sort((a, b) => b.score - a.score);
//   res.send(results)

// })

app.get('/search/:query', async (req, res) => {
  try {
    const queryText = req.params.query.trim();

    // 1. Convert the search term into a vector
    const qEmbedding = await extractor(queryText, {
      pooling: "mean",
      normalize: true
    });
    const qVector = Array.from(qEmbedding.data);

    const results = await index.queryItems(qVector,'', 20);

    const formattedResults = results.map(res => ({
      title: res.item.metadata.title,
      score: (res.score * 100).toFixed(2) + "%"
    }));

    res.send(formattedResults);

  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).send({ error: "Search failed" });
  }
});


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // keep extension
    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage });

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const inputPath = path.resolve(req.file.path);
    const outputPath = inputPath + "_fixed.wav";
    
    // 1. Manually define your working paths
    const ffmpegExe = "G:/ffmpeg/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe";
    const whisperExe = "G:/Node Projects/MERN Stack/Search-LLM/node_modules/nodejs-whisper/whisper.cpp/main.exe";
    const modelPath = "G:/Node Projects/MERN Stack/Search-LLM/node_modules/nodejs-whisper/whisper.cpp/models/ggml-large-v3.bin";

    console.log("[Step 1] Converting Opus/WebM to 16kHz Wav...");

    // This command fixes the "Error parsing Opus" by forcing a re-encode to 16kHz PCM
    const ffmpegCmd = `"${ffmpegExe}" -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}" -y`;

    exec(ffmpegCmd, (fErr) => {
      if (fErr) {
        console.error("FFmpeg Error:", fErr);
        return res.status(500).json({ error: "FFmpeg failed to fix audio format." });
      }

      console.log("[Step 2] Running Whisper Engine...");
      // -nt = no timestamps, -otxt = output text
      const whisperCmd = `"${whisperExe}" -m "${modelPath}" -f "${outputPath}" -nt`;

      exec(whisperCmd, (wErr, stdout, stderr) => {
        if (wErr) {
          console.error("Whisper Error:", stderr);
          return res.status(500).json({ error: "Whisper engine crashed." });
        }

        console.log("Transcription Result:", stdout);
        
        // Cleanup: Delete the temporary files
        [inputPath, outputPath].forEach(p => fs.unlink(p, () => {}));

        res.json({ transcript: stdout.trim() });
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});


async function run() {
  const audioFile = "G:/Node Projects/Whisper CPP/Release/test.wav";

  console.log("Loading model: large-v3-turbo (Accurate)...");
  
  // Create the pipeline
  const transcriber = await pipeline(
    'automatic-speech-recognition', 
    'onnx-community/whisper-large-v3-turbo'
);

  // Load and prepare the audio
  const buffer = fs.readFileSync(audioFile);
  const wav = new wavefile.WaveFile(buffer);
  
  // Whisper needs 16kHz Mono 32-bit float
  wav.toBitDepth('32f'); 
  wav.toSampleRate(16000);
  
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) audioData = audioData[0]; // Use first channel if stereo

  console.log("Transcribing...");
  const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'english', // Explicitly setting language improves accuracy
      task: 'transcribe',
  });

  console.log("\n--- RESULT ---\n");
  console.log(result.text);
}

run().catch(console.error);
