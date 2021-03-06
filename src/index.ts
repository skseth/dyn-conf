import { EventEmitter } from 'events'

export class Config implements Config.Prop {
    private props: Map<string,Config.Prop> = new Map()
    private secretPropNames: string[]
    private sources: Config.PropSource[] = []
    private secretSource: Config.SecretSource
    private proxy: any
    private changeEmitter = new EventEmitter()
    private parent: Config

    constructor(private values: any) {
        const meta = values.__config_meta__
        this.secretPropNames = (meta && meta.secrets) ? meta.secrets : []

        Object.defineProperty(values, '__config_meta__', {
            enumerable: false,
        })

        this.proxy = new Proxy(values, this.Handler)
    }

    public setSecretSource(secretSource: Config.SecretSource) {
        this.secretSource = secretSource
        return this
    }

    public addSource(source: Config.PropSource) {
        this.sources.splice(0,0, source)
        return this
    }

    public setValue(value: any, propogateToParent=true) {
        for (const propKey in value) {
            if (value.hasOwnProperty(propKey)) {
                this.setPropValue(propKey, value[propKey])
            }
        }

        this.emitChange(propogateToParent)
        return true
    }

    private setParent(parent: Config) {
        this.parent = parent
        return this
    }

    private setSourcesWithChild(sources: Config.PropSource[], propKey: string) {
        sources.map(source => this.sources.push(source.createChildSource(propKey)))
        return this
    }

    private getProp(propKey: string) {
        return this.props.get(propKey) || this.createProp(propKey)
    }

    private createProp(propKey: string) {
        const createByType = () => {
            if (this.values[propKey] instanceof Object) {
                return new Config(this.values[propKey])
                    .setSourcesWithChild(this.sources, propKey)
                    .setSecretSource(this.secretSource)
                    .setParent(this)
            }

            if (this.secretPropNames.indexOf(propKey) >= 0) {
                return new Config.SecretProp(this.values[propKey], propKey, this.sources, this.secretSource)
            }

            return new Config.PrimitiveProp(this.values[propKey], propKey, this.sources)
        }

        if (propKey in this.values) {
            const child = createByType()
            this.props.set(propKey, child)
            return child
        }

        throw new Error(`${propKey} not a valid config property`)
    }

    private getPropValue(propKey: string) {
        return this.getProp(propKey).Value
    }

    private setPropValue(propKey: string, value: any): boolean {
        return this.getProp(propKey).setValue(value, false)
    }

    private emitChange(propogateToParent=true) {
        this.changeEmitter.emit('change', this.Value)
        if (propogateToParent && this.parent) this.parent.emitChange(true)
    }

    private registerChangeHandler(handler: Config.ChangeHandler) {
        this.changeEmitter.on('change', handler)
    }

    private get Handler() {
        const self = this
        return {
            get(target: any, propKey: string, receiver: any) {
                if (propKey in self.values) {
                    return self.getPropValue(propKey)
                } else if (propKey === 'onChange') {
                    return (handler: Config.ChangeHandler) => self.registerChangeHandler(handler)
                }
            },
            set(target: any, propKey: any, value: any, receiver: any): boolean {
                const retval = self.setPropValue(propKey, value )
                self.emitChange(true)
                return retval
            },
        }
    }

    public get Value() {
        return this.proxy
    }
}

export namespace Config {

    export interface SecretSource {
        getSecret(name: string): any
    }

    export interface Prop {
        readonly Value: any
        setValue(value: any, propogateToParent: boolean): boolean
    }

    export interface PropSource {
        readonly Proxy: any
        createChildSource(propKey: string): PropSource
    }

    export type ChangeHandler = (config: any) => void

    export class PrimitiveProp implements Prop {

        private dynamicValue: any

        constructor(private value: any, private propKey: string,
                    private sources: PropSource[] = [], protected secretSource?: SecretSource) {}

        public setValue(newvalue: any) {
            this.dynamicValue = newvalue
            return true
        }

        get Value() {
            if (this.dynamicValue != null) return this.dynamicValue

            for (const source of this.sources) {
                const val = source.Proxy[this.propKey]
                if (val) return val
            }

            return this.value
        }
    }

    export class SecretProp extends PrimitiveProp {

        get Value() {
            const val = super.Value
            return (this.secretSource) ? this.secretSource.getSecret(val) : val
        }
    }

    export class ArgsSource implements PropSource {
        private proxy: any

        constructor(private args: any = {}, public argprefix: string = "") {
            this.proxy = new Proxy({}, this.Handler)
        }

        public createChildSource(propKey: string) {
            return new ArgsSource(this.args, this.childName(propKey))
        }

        private childName(propKey: string) {
            return this.argprefix? `${this.argprefix}-${propKey.toLowerCase()}` : propKey.toLowerCase()
        }

        private get Handler() {
            const self = this
            return {
                get(target: any, propKey: string, receiver: any) {
                    if (typeof propKey === 'string') {
                        return self.args[self.childName(propKey)]
                    }
                },
            }
        }

        get Proxy() { return this.proxy}
    }

    export class EnvSource implements PropSource {
        private proxy: any

        constructor(public env: any = {}, public envprefix: string = "") {
            this.proxy = new Proxy({}, this.Handler)
        }

        public createChildSource(propKey: string) {
            return new EnvSource(this.env, this.childName(propKey))
        }

        private childName(propKey: string) {
            return this.envprefix ? `${this.envprefix}_${propKey.toUpperCase()}` : propKey.toUpperCase()
        }

        private get Handler() {
            const self = this
            return {
                get(target: any, propKey: string, receiver: any) {
                    if (typeof propKey === 'string') {
                        return self.env[self.childName(propKey)]
                    }
                },
            }
        }

        get Proxy() { return this.proxy }
    }

    export class ObjSource implements PropSource {
        private proxy: any

        constructor(private obj: any = {}) {
            this.proxy = new Proxy({}, this.Handler)
        }

        public createChildSource(propKey: string) {
            return new ObjSource(this.obj[propKey])
        }

        private get Handler() {
            const self = this
            return {
                get(target: any, propKey: string, receiver: any) {
                    return self.obj[propKey]
                },
            }
        }

        get Proxy() { return this.proxy }
    }
}
