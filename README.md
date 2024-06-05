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

Make sure you have docker and docker-compose installed.
Put docker-compose.yml, service_account.json, and .env in the same directory.
Navigate to that directory and run:

```
sudo docker pull lsha0730/docker
sudo docker compose up -d
```

Dinubot will run in the background.
Add a --build flag to the end if the directory the docker-compose.yml file is in also has the project files and you want to re-build the image locally
Check to see if its running with `sudo docker ps`

Spin it down with `sudo docker compose down`


## Contributing

Check out our [contribution guidelines](<!--- Link to CONTRIBUTING.md -->)
