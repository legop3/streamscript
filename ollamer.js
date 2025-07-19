import { Ollama } from 'ollama'
import fs from 'fs'
import tmi from 'tmi.js'

const client = new tmi.Client({
    channels: ['carpetfuzz']
})

client.connect()

client.on('message', (channel, tags, message, self) => {
    if (self) return
    console.log(message)

    
})

const olserver = 'http://192.168.0.22:11434'

const systemPrompt = await fs.readFileSync('system.txt', 'utf8')

const ollama = new Ollama({host: olserver})

const response = await ollama.chat({
    model: 'llava:7b',
    messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: 'What are you doing'},
    ],
    stream: true
})
for await (const part of response) {
    process.stdout.write(part.message.content)
}

// console.log(response.message.content)