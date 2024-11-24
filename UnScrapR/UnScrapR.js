const { google } = require('googleapis');
const localAuth = require('@google-cloud/local-auth');
const readline = require('readline');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

async function main() {
  const auth = await localAuth.authenticate({
    scopes: SCOPES,
    keyfilePath: './credentials.json'
  });
  const gmail = google.gmail({version: 'v1', auth});

  const res = await gmail.users.messages.list({ userId: 'me' });
  const messages = res.data.messages;
  if (!messages) {
    console.log("No messages found.");
    return;
  }
  console.log(`Found ${messages.length} messages.`);

  const outputFile = 'unsubscribe_links.txt';
  fs.writeFileSync(outputFile, '');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  for (let message of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full'
    });

    let bodyPart = msg.data.payload.parts ? msg.data.payload.parts.find(part => part.mimeType === 'text/html') : null;
    let body = bodyPart ? bodyPart.body.data : (msg.data.payload.body ? msg.data.payload.body.data : null);
    
    if (!body) {
      console.log("No suitable body content found.");
      continue;
    }

    const decodedBody = Buffer.from(body, 'base64').toString('utf8');
    const links = decodedBody.match(/https?:\/\/[\S]+list-manage.com\/unsubscribe[\S]*/g);

    if (!links || !links.length) {
      console.log("No unsubscribe links found in this message.");
      continue;
    }

    console.log(`Found ${links.length} links in a message.`);
    links.forEach(link => {
      fs.appendFileSync(outputFile, `Unsubscribe link found: ${link}\n`);
    });
  }

  console.log(`Unsubscribe links written to ${outputFile}.`);
  let fileContents = fs.readFileSync(outputFile, 'utf8');
  console.log("Current file contents:", fileContents);

  rl.close();
}

main().catch(console.error);