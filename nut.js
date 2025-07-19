import tmi from 'tmi.js'

const client = new tmi.Client({
    channels: ['carpetfuzz']
})

client.connect()

client.on('message', (channel, tags, message, self) => {
    if (self) return
    console.log(message)

    
})