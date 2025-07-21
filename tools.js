const tools = [

  //mostly for testing, print a message to console
//   {
//     type: 'function',
//     function: {
//       name: 'print_message',
//       description: 'print a message to the console',
//       parameters: {
//         type: 'object',
//         properties: {
//           message: {
//             type: 'string',
//             description: 'the message to print to the console'
//           }
//         },
//         required: ['message']
//       }
//     }
//   },

  // allow the model to show or hide the loading icon
  {
    type: 'function',
    function: {
        name: 'control_loading_icon',
        description: 'show or hide the loading icon',
        parameters: {
            type: 'object',
            properties: {
                visible: {
                    type: 'boolean',
                    description: 'whether to show or hide the loading icon, true for show and false for hide'
                }
            },
            required: ['visible']
        }
    }
  }





]



export {
    tools
}