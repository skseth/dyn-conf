import * as assert from 'assert';
import { Config } from '../lib';
import * as minimist from 'minimist'

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


    describe('#getPropValue()', function() {
        it('should return exactly the configured parameters', function() {
            const nometaconfig = new Config(nometaConfigDefault);
            assert.deepStrictEqual(nometaConfigDefault, nometaconfig.Value)
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
            assert.deepStrictEqual(nometaConfigDefault, secretconfig.Value)
        });

        it('should accept arguments derived from defaults only', function() {
            let argsConfigDefault = JSON.parse(JSON.stringify(nometaConfigDefault));
            argsConfigDefault.node.env = 'xyz'
            argsConfigDefault.mongoose.options.pass = 'abcd'
            const argsconfig = new Config(argsConfigDefault)
                                .addSource(new Config.ArgsSource(minimist([
                                                    '--node-extra=EXTRA', 
                                                    '--node-env=development', 
                                                    '--mongoose-options-pass=somepass'])))
            assert.equal("somepass", argsconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof argsconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, argsconfig.Value)
        })

        it('should accept environment variables derived from defaults only', function() {
            let envConfigDefault = JSON.parse(JSON.stringify(nometaConfigDefault));
            envConfigDefault.node.env = 'xyz'
            envConfigDefault.mongoose.options.pass = 'abcd'
            const envconfig = new Config(envConfigDefault)
                                .addSource(new Config.EnvSource({
                                        NODE_EXTRA:'EXTRA', 
                                        NODE_ENV:'development', 
                                        MONGOOSE_OPTIONS_PASS:'somepass'}))
            assert.equal("somepass", envconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof envconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, envconfig.Value)
        })

        it('should accept object variables derived from defaults only', function() {
            let objConfigDefault = JSON.parse(JSON.stringify(nometaConfigDefault));
            objConfigDefault.node.env = 'xyz'
            objConfigDefault.mongoose.options.pass = 'abcd'
            const objconfig = new Config(objConfigDefault)
                                .addSource(new Config.ObjSource({
                                        node: { extra : 'EXTRA', env: 'development'},
                                        mongoose: { options: { pass: 'somepass'}}
                                }))
            assert.equal("somepass", objconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof objconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, objconfig.Value)
        }) 

    });

})