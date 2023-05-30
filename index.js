const { App } = require("@slack/bolt");


require('dotenv').config();

const botToken = process.env.token;
const botSigningSecret = process.env.signingSecret;
const botAppToken = process.env.appToken;

const app = new App({
    token: botToken, //Find in the Oauth  & Permissions tab
    signingSecret: botSigningSecret, // Find in Basic Information Tab
    socketMode:true,
    appToken: botAppToken // Token from the App-level Token that we created
});


app.command("/test", async ({ command, say }) => {
    try {
        say("Hello")
    } 
    
    catch (error) {
        console.error(error);
    }
});

app.start(3000)