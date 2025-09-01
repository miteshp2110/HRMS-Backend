const app = require("./src/app");
const { serverPort } = require("./src/config/secrets");
const { checkConnection } = require("./src/db/connector");

async function main() {
    if(await checkConnection()){
        console.log("Database Connected Successfully...")
        app.listen(serverPort,()=>{
            console.log(`Server Listening on ${serverPort}`)
        })
    }
    else{
        console.log("Failed to connect to Database!!!")
        process.exit(1)
    }

}

main()