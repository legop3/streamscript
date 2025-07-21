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



export {
    tools
}