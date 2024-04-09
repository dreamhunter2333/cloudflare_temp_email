# mail-parser-wasm

## usage

```js
import { parse_message } from 'mail-parser-wasm'

const parsedEmail = parse_message(item.raw);
```

## build

```bash
wasm-pack build --release
wasm-pack publish
```
