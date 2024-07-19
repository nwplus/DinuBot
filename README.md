# DinuBot

How DinuBot pairs people together
![DinuBot Pairing Diagram](./images/dinubotAlgo.png)

<!--- Brief description of the project and what it's used for] -->

## Getting started

<!--- Make sure to include any additional steps like setting env variables] -->

Note: If you schedule a message, the message will still be sent after you turn off the bot. This is because Slack remembers it

## Running locally (dev)

```
yarn install
node index.js
```

Remember to set up `.env` and `service_account.json`.

## Deploying

Push the new version to the production branch in Github. GitHub Actions will pull, build and deploy the code.

Note: If you've changed the .env or service_account.json files, update them on the server by either:
1. Repository settings -> Security -> Secrets and Variables -> Actions -> Repository Secrets.
    Then goto the Actions tab and dispatch the 'Refresh Secrets on Server' workflow.
2. OR, push changes to the production branch. Refreshing secrets is part of the build workflow.


## Contributing

Check out our [contribution guidelines](<!--- Link to CONTRIBUTING.md -->)
