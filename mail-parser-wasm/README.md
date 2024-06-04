# mail-parser-wasm web and cf worker

## [mail-parser-wasm](https://www.npmjs.com/package/mail-parser-wasm)

### mail-parser-wasm usage

```bash
pnpm add mail-parser-wasm
```

```js
import { parse_message } from 'mail-parser-wasm'

const parsedEmail = parse_message(rawEmail);
```

### mail-parser-wasm build

```bash
wasm-pack build --release
wasm-pack publish
```

## [mail-parser-wasm-worker](https://www.npmjs.com/package/mail-parser-wasm-worker)

### mail-parser-wasm-worker usage

```bash
pnpm add mail-parser-wasm-worker
```

```js
import { parse_message_wrapper } from 'mail-parser-wasm-worker'

const parsedEmail = parse_message_wrapper(rawEmail);
```

### mail-parser-wasm-worker build

```bash
wasm-pack build --out-dir web --target web --release
find web/ -type f ! -name '*.json' ! -name '.gitignore' -exec cp {} worker/ \;
# modify worker/package.json version or whatever
pnpm publish worker --no-git-checks
```
