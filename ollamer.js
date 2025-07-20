import { Ollama } from 'ollama'
import fs from 'fs'
import tmi from 'tmi.js'
import { OBSWebSocket, EventSubscription } from 'obs-websocket-js'

const olserver = 'http://192.168.0.22:11434'
const outfile = 'out.txt'

const systemPrompt = await fs.readFileSync('system.txt', 'utf8')

const ollama = new Ollama({host: olserver})

const obs = new OBSWebSocket();

await obs.connect()

const client = new tmi.Client({
    channels: ['carpetfuzz']
})

client.connect()

client.on('message', async (channel, tags, message, self) => {
    if (self) return
    console.log(message)

    generateText(message)

    
})


async function generateText(prompt) {
    let printout = ''
    fs.writeFileSync(outfile, printout)
    const response = await ollama.chat({
      model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
      system: systemPrompt,
      messages: [
        {role: 'user', content: prompt},
      ],
      stream: true,
      options: {
        temperature: 1,        // Controls randomness (0.0 to 1.0)
        top_p: 0.9,             // Nucleus sampling
        top_k: 40,              // Top-k sampling
        repeat_penalty: 1.1,    // Penalty for repetition
        num_ctx: 2048,          // Context window size
        num_predict: -1,        // Max tokens to generate (-1 for unlimited)
      },
      keep_alive: -1
    })
    
    for await (const part of response) {
      process.stdout.write(part.message.content)
      printout += part.message.content
      fs.writeFileSync(outfile, printout)
    }
  }

// console.log(response.message.content)