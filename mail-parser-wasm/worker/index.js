import initAsync, { initSync, parse_message } from './mail_parser_wasm';
import MODULE from './mail_parser_wasm_bg.wasm';

initSync(MODULE);


export { initAsync, MODULE };
export * from './mail_parser_wasm';
export const parse_message_wrapper = (raw_message) => {
    initSync(MODULE);
    return parse_message(raw_message);
}
