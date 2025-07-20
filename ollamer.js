import { Ollama } from 'ollama'
import fs from 'fs'
import tmi from 'tmi.js'
import { OBSWebSocket, EventSubscription } from 'obs-websocket-js'
import config from './sceneConfig.json' assert { type: 'json'}

const olserver = 'http://192.168.0.22:11434'
const outfile = 'out.txt'

const systemPrompt = await fs.readFileSync('system.txt', 'utf8')

const ollama = new Ollama({host: olserver})

const obs = new OBSWebSocket();


const tools = [
  {
    type: 'function',
    function: {
      name: 'print_message',
      description: 'print a message to the console',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'the message to print to the console'
          }
        },
        required: ['message']
      }
    }
  }
]

await obs.connect()




class ConversationManager {
  constructor(systemPrompt) {
      this.systemPrompt = systemPrompt
      this.messages = [{role: 'system', content: systemPrompt}]
  }
  
  async generateText(prompt) {
      let printout = ''
      fs.writeFileSync(outfile, printout)


      // await obs.call('GetSceneItemId', {
      //   sceneName: config.objects.ollamaLoadingSpinner.name,
      //   sourceName: config.objects.ollamaLoadingSpinner.scene
      // }, (response) => {
      //   console.log(response.sceneItemId)
      // })
      
      // Add user message to conversation
      this.messages.push({role: 'user', content: prompt})
      
      const response = await ollama.chat({
          model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
          system: this.systemPrompt,
          messages: this.messages,
          tools: tools,
          stream: true,
          options: {
              temperature: 1,
              top_p: 0.9,
              top_k: 40,
              repeat_penalty: 1.1,
              num_ctx: 2048,
              num_predict: -1,
          },
          keep_alive: -1
      })

      
      
      let assistantResponse = ''
      for await (const part of response) {
          process.stdout.write(part.message.content)

          if (part.message.tool_calls) {
            console.log(part.message.tool_calls[0].function.arguments)
          }

          // if(part.message.content.startsWith('<')) {
          //     console.log('think detected', part.message.content)
          // } else {
              printout += part.message.content
              assistantResponse += part.message.content
              fs.writeFileSync(outfile, printout)
          // }
      }
      
      // Add assistant response to conversation
      this.messages.push({role: 'assistant', content: assistantResponse})


      // After collecting the full response
      assistantResponse = assistantResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      fs.writeFileSync(outfile, assistantResponse)
      return assistantResponse
  }
  
  clearConversation() {
      this.messages = [{role: 'system', content: this.systemPrompt}]
  }
  
  getConversation() {
      return this.messages
  }
}




const chat = new ConversationManager(systemPrompt)


const client = new tmi.Client({
    channels: ['carpetfuzz']
})

client.connect()

client.on('message', async (channel, tags, message, self) => {
    if (self) return
    console.log(message)

    // generateText(message)

    if(message.toLowerCase().startsWith('!clear')) {
      chat.clearConversation()
      return
    }

    await chat.generateText(message)

    
})

// async function generateText(prompt, conversationHistory = []) {
//   let printout = ''
//   fs.writeFileSync(outfile, printout)
  
//   // Build messages array with conversation history
//   const messages = [
//       {role: 'system', content: systemPrompt},
//       ...conversationHistory,  // Spread existing conversation
//       {role: 'user', content: prompt}
//   ]
  
//   const response = await ollama.chat({
//       model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
//       system: systemPrompt,
//       messages: messages,
//       stream: true,
//       options: {
//           temperature: 1,
//           top_p: 0.9,
//           top_k: 40,
//           repeat_penalty: 1.1,
//           num_ctx: 2048,
//           num_predict: -1,
//       },
//       keep_alive: -1
//   })
  
//   let assistantResponse = ''
//   for await (const part of response) {
//       process.stdout.write(part.message.content)
//       if(part.message.content.startsWith('<')) {
//           console.log('think detected', part.message.content)
//       } else {
//           printout += part.message.content
//           assistantResponse += part.message.content
//           fs.writeFileSync(outfile, printout)
//       }
//   }
  
//   // Return the assistant's response for conversation tracking
//   return assistantResponse
// }

// console.log(response.message.content)



