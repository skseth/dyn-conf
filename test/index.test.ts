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

    let modifiedConfigDefault = JSON.parse(JSON.stringify(nometaConfigDefault));
    modifiedConfigDefault.node.env = 'xyz'
    modifiedConfigDefault.mongoose.options.pass = 'abcd'    


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
            const argsconfig = new Config(modifiedConfigDefault)
                                .addSource(new Config.ArgsSource(minimist([
                                                    '--node-extra=EXTRA', 
                                                    '--node-env=development', 
                                                    '--mongoose-options-pass=somepass'])))
            assert.equal("somepass", argsconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof argsconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, argsconfig.Value)
        })

        it('should accept environment variables derived from defaults only', function() {
            const envconfig = new Config(modifiedConfigDefault)
                                .addSource(new Config.EnvSource({
                                        NODE_EXTRA:'EXTRA', 
                                        NODE_ENV:'development', 
                                        MONGOOSE_OPTIONS_PASS:'somepass'}))
            assert.equal("somepass", envconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof envconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, envconfig.Value)
        })

        it('should accept object variables derived from defaults only', function() {
            const objconfig = new Config(modifiedConfigDefault)
                                .addSource(new Config.ObjSource({
                                        node: { extra : 'EXTRA', env: 'development'},
                                        mongoose: { options: { pass: 'somepass'}}
                                }))
            assert.equal("somepass", objconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof objconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, objconfig.Value)
        }) 

    });


    describe('#setPropValue()', function() {
        it('should allow setting of values for existing properties', function() {
            const setconfig = new Config(modifiedConfigDefault)
            setconfig.Value.mongoose.options.pass = "somepass"
            setconfig.Value.node.env = "development"
            assert.equal("somepass", setconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof setconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, setconfig.Value)
        });

        it('should allow setting of a bag of properties', function() {
            const setconfig = new Config(modifiedConfigDefault)
            setconfig.setValue({
                    node: { env: 'development'},
                    mongoose: { options: { pass: 'somepass'}}
            })
            assert.equal("somepass", setconfig.Value.mongoose.options.pass)
            assert.equal('undefined', typeof setconfig.Value.node.extra)
            assert.deepStrictEqual(nometaConfigDefault, setconfig.Value)
        });

        it('should not allow setting of values for arbitrary properties', function() {
            const setconfig = new Config(modifiedConfigDefault)
            assert.throws(() => setconfig.Value.node.extra = 'EXTRA', /extra not a valid config property/)
        });

    });


})