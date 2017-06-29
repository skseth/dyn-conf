import * as assert from 'assert';
import { Config } from '../src';
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
            assert.equal('someuser', nometaconfig.Value.mongoose.options.user)            
            assert.deepStrictEqual(nometaConfigDefault, nometaconfig.Value)
        });

        it('should return undefined for non-existent properties', function() {
            const nometaconfig = new Config(nometaConfigDefault);
            assert.equal('undefined', typeof nometaconfig.Value.node.extra)
            assert.equal('undefined', typeof nometaconfig.Value.inspect)
            assert.equal('undefined', typeof nometaconfig.Value[Symbol.toStringTag])
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


    describe('#ArgsSource', function() {
        it('should return set properties', function() {
            const argSource = new Config.ArgsSource({_: {}, a: 20, 'b-c': 30})
            assert.equal(20, argSource.Proxy.a)
            assert.equal('undefined', typeof argSource.Proxy.b)
        });

        it('should not have any properties for empty object', function() {
            const argSource = new Config.ArgsSource()
            assert.deepStrictEqual({}, argSource.Proxy)
        });

        it('should create child source', function() {
            const argSource = new Config.ArgsSource({_: {}, a: 20, 'b-c': 30})
            const childSource = argSource.createChildSource('b')
            assert.equal(30, childSource.Proxy.c)
        });
    });

    describe('#EnvSource', function() {
        it('should return set properties', function() {
            const envSource = new Config.EnvSource({A: 20, B_C: 30})
            assert.equal(20, envSource.Proxy.a)
            assert.equal('undefined', typeof envSource.Proxy.b)
        });

        it('should not have any properties for empty object', function() {
            const envSource = new Config.EnvSource()
            assert.deepStrictEqual({}, envSource.Proxy)
        });

        it('should create child source', function() {
            const envSource = new Config.EnvSource({A: 20, B_C: 30})
            const childSource = envSource.createChildSource('b')
            assert.equal(30, childSource.Proxy.c)
        });
    });


    describe('#ObjSource', function() {
        it('should return set properties', function() {
            const objSource = new Config.ObjSource({a: 20, b: {c: 30}})
            assert.equal(20, objSource.Proxy.a)
            assert.equal(30, objSource.Proxy.b.c)
        });

        it('should not have any properties for empty object', function() {
            const objSource = new Config.ObjSource()
            assert.deepStrictEqual({}, objSource.Proxy)
        });


        it('should create child source', function() {
            const objSource = new Config.ObjSource({a: 20, b: {c: 30}})
            const childSource = objSource.createChildSource('b')
            assert.equal(30, childSource.Proxy.c)
        });
    });

    describe('#PrimitiveProp', function() {
        it('should return default value if no source', function() {
            const prop = new Config.PrimitiveProp(20, "someprop")
            assert.equal(20, prop.Value)
        });

        it('should return first source value with property', function() {
            const objSource1 = new Config.ObjSource({someotherprop: 40})
            const objSource2 = new Config.ObjSource({someprop: 30})            
            const prop = new Config.PrimitiveProp(20, "someprop", [objSource1, objSource2])
            assert.equal(30, prop.Value)
        });

        it('should return dynamic value when set', function() {
            const objSource1 = new Config.ObjSource({someotherprop: 40})
            const objSource2 = new Config.ObjSource({someprop: 30})            
            const prop = new Config.PrimitiveProp(20, "someprop", [objSource1, objSource2])
            assert.equal(30, prop.Value)
            prop.setValue(50)
            assert.equal(50, prop.Value)
        });
    });

    describe('#SecretProp', function() {
        it('should return default value if no secret source', function() {
            const prop = new Config.SecretProp("sekrit", "someprop")
            assert.equal("sekrit", prop.Value)
        });

        it('should return secret value from secret source', function() {
            const objSource = new Config.ObjSource({someprop: "sekrit"})
            const prop = new Config.SecretProp("oldsekrit", "someprop", [objSource], { 
                        getSecret: function(secretname) {
                            if (secretname === "sekrit") {
                                return "theactualsecret"
                            }
                            else if (secretname === "dynamo") {
                                return "dynamosecret"
                            }
                        }})
            assert.equal("theactualsecret", prop.Value)
            prop.setValue("dynamo")
            assert.equal("dynamosecret", prop.Value)            
        });
    });

    describe('#onChange', function() {
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

        it('should invoke change handler on setValue', function() {
            const nometaconfig = new Config(nometaConfigDefault);
            let newmongoose: any
            nometaconfig.Value.mongoose.onChange(function(config:any) {
                newmongoose = config
            })

            nometaconfig.setValue({mongoose: { options: { pass: 'someotherpass'} }})

            assert.equal('someotherpass', newmongoose.options.pass)
        });

        it('should invoke change handler on parent when prop changed', function() {
            const nometaconfig = new Config(nometaConfigDefault);
            let newmongoose: any
            let newconfig: any
            
            nometaconfig.Value.mongoose.onChange(function(config:any) {
                newmongoose = config
            })
            
            nometaconfig.Value.onChange(function(config:any) {
                newconfig = config
            })

            nometaconfig.Value.mongoose.options.pass = 'someotherpass'

            assert.equal('someotherpass', newmongoose.options.pass)
            assert.equal('someotherpass', newconfig.mongoose.options.pass)
        });


    });

})