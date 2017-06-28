import * as assert from 'assert';

import { Config } from '../lib';

describe("Config", function() {
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


    describe('#get()', function() {
        it('should return exactly the configured parameters', function() {
            const nometaconfig = new Config(nometaConfigDefault);
            assert.deepStrictEqual(nometaConfigDefault, nometaconfig.Value);
        });

        it('should replace secret with actual value', function() {
            const expectedPass = 'somepass'

            // prepare secret config as a copy
            let secretConfigDefault = JSON.parse(JSON.stringify(nometaConfigDefault));
            secretConfigDefault.mongoose.options.pass = 'pwd' // name of secret
            secretConfigDefault.mongoose.options.__config_meta__ = {
                secrets : ['pass'] 
            }


            const secretconfig = new Config(secretConfigDefault)
                    .setSecretSource({ getSecret: function(name) { return (name === 'pwd')? expectedPass: 'UNKNOWN' }})
            assert.equal(expectedPass, secretconfig.Value.mongoose.options.pass)
            assert.deepStrictEqual(nometaConfigDefault, secretconfig.Value);
        });
    });

})