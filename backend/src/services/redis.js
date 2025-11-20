import {createClient} from "redis";

// Conditional logger
function log(...args) {
    if (process.env.REDIS_LOGGING === 'true') {
        console.log('Redis:', ...args);
    }
}

class RedisSingleton {
    constructor({ url }) {
        this.client = createClient({ url });

        // Connection state
        this._connectPromise = null;
        this._connected = false;

        // Useful diagnostics
        this.client.on('error', (err) => console.error('Redis Error:', err));
        this.client.on('connect', () => {
            this._connected = true;
            console.log(`Redis connected to ${url}`);
        });
        this.client.on('reconnecting', () => console.log(`Redis reconnecting to ${url}...`));
        this.client.on('end', () => {
            this._connected = false;
            this._connectPromise = null;
            console.log(`Redis disconnected from ${url}`);
        });
    }

    // Ensure a single connect attempt and reuse it
    async connect() {
        if (!this._connectPromise) {
            this._connectPromise = this.client
                .connect()
                .then(() => {
                    this._connected = true;
                    return this.client;
                })
                .catch((err) => {
                    this._connectPromise = null;
                    throw err;
                });
        }
        return this._connectPromise;
    }

    // Explicit client getter (if you need direct access)
    async getClient() {
        await this.connect();
        return this.client;
    }

    // --- Internal helpers to DRY cache ops ---

    async _read(key, {parse} = {}) {
        await this.connect();
        const raw = await this.client.get(key);

        if (raw == null) {
            log('Cache miss:', key);
            return null;
        }

        log('Cache hit:', key);
        return parse ? parse(raw) : raw; // default is raw string
    }

    async _write(key, value, {ttlSeconds, serialize} = {}) {
        await this.connect();

        const payload = serialize ? serialize(value) : value;

        if (ttlSeconds) {
            log('Setting:', key, `(TTL:${ttlSeconds})`);
            return this.client.set(key, payload, {EX: ttlSeconds});
        }

        log('Setting:', key);
        return this.client.set(key, payload);
    }

    // --- Public API built on top of the helpers ---

    // String get
    async get(key) {
        return this._read(key);
    }

    // String set
    async set(key, value, ttlSeconds) {
        return this._write(key, value, { ttlSeconds });
    }

    // JSON get
    async getJSON(key) {
        return this._read(key, { parse: JSON.parse });
    }

    // JSON set
    async setJSON(key, value, ttlSeconds) {
        return this._write(key, value, { ttlSeconds, serialize: JSON.stringify });
    }

    // Graceful shutdown
    async quit() {
        try {
            // Prefer `isOpen` (true when the socket is open). Some setups also check `isReady`.
            if (this.client && this.client.isOpen) {
                await this.client.quit();
            }
        } catch (e) {
            // If it's already closed, ignore ClientClosedError
            if (e && e.name !== 'ClientClosedError') {
                console.error('Redis quit error:', e);
            }
        } finally {
            this._connected = false;
            this._connectPromise = null;
        }
    }
}

function wrap(singleton) {
    return new Proxy(singleton, {
        get(target, prop, receiver) {
            // If it's a member on the wrapper (e.g., connect, getJSON), use it.
            if (prop in target) return Reflect.get(target, prop, receiver);

            // Otherwise, forward to the client after connecting.
            return async (...args) => {
                await target.connect();
                const member = target.client[prop];
                // Non-function properties are returned directly
                if (typeof member !== 'function') return member;
                // Call the client method with provided args
                return member.apply(target.client, args);
            };
        },
    });
}

// Default client
const redis = wrap(new RedisSingleton({ url: process.env.REDIS_URI }));

export default redis;
