import initAsync, { MessageResult } from './mail_parser_wasm';
import MODULE from './mail_parser_wasm_bg.wasm';
export { initAsync, MODULE };
export * from './mail_parser_wasm';
/**
* @param {string} raw_message
* @returns {MessageResult}
*/
export function parse_message_wrapper(raw_message: string): MessageResult;
