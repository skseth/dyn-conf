const Config = require('../dist').Config

let nometaConfigDefault = {
    node: {
        env: 'development'
    },
    mongoose: {
        uri: 'mongodb://localhost/family',
        options: {
            user: 'someuser',
            pass: 'somepass'
        }
    }
}

const config = new Config(nometaConfigDefault).Value

console.log(config)