extern crate wasm_bindgen;

use mail_parser::{MessageParser, MimeHeaders};
use wasm_bindgen::prelude::*;

#[derive(Clone)]
#[wasm_bindgen]
pub struct AttachmentResult {
    content_id: String,
    content_type: String,
    filename: String,
    content: Vec<u8>,
}

#[wasm_bindgen]
impl AttachmentResult {
    #[wasm_bindgen(getter)]
    pub fn content_id(&self) -> String {
        self.content_id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn content_type(&self) -> String {
        self.content_type.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn filename(&self) -> String {
        self.filename.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn content(&self) -> Vec<u8> {
        self.content.clone()
    }
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct MessageHeader {
    key: String,
    value: String,
}

#[wasm_bindgen]
impl MessageHeader {
    #[wasm_bindgen(getter)]
    pub fn key(&self) -> String {
        self.key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn value(&self) -> String {
        self.value.clone()
    }
}

#[wasm_bindgen]
pub struct MessageResult {
    sender: String,
    subject: String,
    headers: Vec<MessageHeader>,
    body_html: String,
    text: String,
    attachments: Vec<AttachmentResult>,
}

#[wasm_bindgen]
impl MessageResult {
    #[wasm_bindgen(getter)]
    pub fn sender(&self) -> String {
        self.sender.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn subject(&self) -> String {
        self.subject.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn headers(&self) -> Vec<MessageHeader> {
        self.headers.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn body_html(&self) -> String {
        self.body_html.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn text(&self) -> String {
        self.text.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn attachments(&self) -> Vec<AttachmentResult> {
        self.attachments.clone()
    }
}

pub fn parse_attachment(message: &mail_parser::Message) -> Vec<AttachmentResult> {
    let mut attachments: Vec<AttachmentResult> = Vec::new();
    for attachment in message.attachments() {
        if !attachment.is_message() {
            attachments.push(AttachmentResult {
                content_id: attachment
                    .content_id()
                    .map(|id| id.to_owned())
                    .unwrap_or(String::new()),
                content_type: attachment
                    .content_type()
                    .map(|ct| {
                        let c_type = ct.c_type.clone().into_owned();
                        let c_subtype = ct.c_subtype.clone();
                        if c_subtype.is_none() {
                            return c_type;
                        } else {
                            return format!("{}/{}", c_type, c_subtype.unwrap());
                        }
                    })
                    .unwrap_or(String::new()),
                filename: attachment
                    .attachment_name()
                    .map(|name| name.to_owned())
                    .unwrap_or(String::new()),
                content: attachment.contents().to_vec(),
            });
        } else {
            attachments.append(
                &mut attachment
                    .message()
                    .map(|msg| parse_attachment(msg))
                    .unwrap_or(Vec::new()),
            );
        }
    }
    attachments
}

#[wasm_bindgen]
pub fn parse_message(raw_message: &str) -> MessageResult {
    // check if the message is valid
    let res = MessageParser::default().parse(raw_message);
    if res.is_none() {
        return MessageResult {
            sender: String::new(),
            subject: String::new(),
            headers: Vec::new(),
            body_html: String::new(),
            text: String::new(),
            attachments: Vec::new(),
        };
    }
    let message = res.unwrap();

    MessageResult {
        sender: message
            .from()
            .and_then(|from| from.first())
            .map(|addr| {
                if addr.name().is_some() {
                    return format!(
                        "{} <{}>",
                        addr.name().unwrap(),
                        addr.address().unwrap_or("")
                    );
                } else {
                    return addr.address().unwrap_or("").to_owned();
                }
            })
            .unwrap_or(String::new()),
        subject: message
            .subject()
            .map(|subject| subject.to_owned())
            .unwrap_or(String::new()),
        headers: message
            .headers()
            .iter()
            .map(|header| MessageHeader {
                key: header.name().to_owned(),
                value: header.value().as_text().unwrap_or("").to_owned(),
            })
            .collect(),
        body_html: message
            .body_html(0)
            .map(|html| html.into_owned())
            .unwrap_or(String::new()),
        text: message
            .body_text(0)
            .map(|text| text.into_owned())
            .unwrap_or(String::new()),
        attachments: parse_attachment(&message),
    }
}
