const { App } = require("@slack/bolt");
const { WebClient } = require('@slack/web-api');

require('dotenv').config();

const botToken = process.env.token;
const botSigningSecret = process.env.signingSecret;
const botAppToken = process.env.appToken;

const slackClient = new WebClient(botToken);

const app = new App({
    token: botToken, //Find in the Oauth  & Permissions tab
    signingSecret: botSigningSecret, // Find in Basic Information Tab
    socketMode:true,
    appToken: botAppToken // Token from the App-level Token that we created
});


app.command("/test", async ({ command, event, say }) => {
    try {
        console.log(event)
        say(`<@${event}> hello!`)
    } 
    
    catch (error) {
        console.error(error);
    }
});

// app.message("hello", async ({ command, say }) => {
//    console.log("Ran hello") 
//     try {
//       say("AHAHAHAHAHHAH");
//     } catch (error) {
//         console.log("err")
//       console.error(error);
//     }
// });

async function sendMessage(channel, message) {
    try {
      const response = await slackClient.chat.postMessage({
        channel: channel,
        text: message,
      });
  
      console.log('Message sent successfully:', response.ts);
    } 
    catch (error) {
      console.error('Error sending message:', error);
    }
  }

// sendMessage("C05A02Q37FC", "Hello, world!")
app.action("button_clicked", async ({ body, say }) => {
    console.log("Button clicked");

    const buttonValue = body.actions[0].value;
  
    if (buttonValue === "didDonut") {
      console.log("Button was clicked");
      say("Yay");
    } else if (buttonValue === "scheduled") {
      console.log("Another button was clicked");
      say("Ok");
    } else {
      console.log("Unknown button action");
      say("Smh");
    }
  });
  

async function donutCheckin(channel, message, buttonAction) {
    try {
      const response = await slackClient.chat.postMessage({
        channel: channel,
        text: message,
        attachments: [
          {
            text: "Click the button below:",
            fallback: "You are unable to interact with this button.",
            callback_id: buttonAction,
            actions: [
              {
                name: "button",
                text: "Yes",
                type: "button",
                value: "didDonut",
              },
              {
                name: "button",
                text: "It's scheduled",
                type: "button",
                value: "scheduled",
              },
              {
                name: "button",
                text: "Not yet",
                type: "button",
                value: "notScheduled",
              },
            ],
          },
        ],
      });
  
      console.log('Message sent successfully:', response.ts);
    } 
    catch (error) {
      console.error('Error sending message:', error);
    }
}

donutCheckin("C05A02Q37FC", "Did you meet yet?", "button_clicked");

app.start(3000)