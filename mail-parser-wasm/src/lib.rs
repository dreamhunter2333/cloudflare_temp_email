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
            .zip(message.headers_raw())
            .map(|(header, (key, raw))| MessageHeader {
                key: key.to_owned(),
                value: header.value().as_text().unwrap_or(raw.trim()).to_owned(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_structured_and_repeated_headers() {
        let raw = concat!(
            "From: =?UTF-8?B?5rWL6K+V?=\r\n <first@example.com>\r\n",
            "From: Last <last@example.com>\r\n",
            "To: Team: one@example.com, two@example.com;\r\n",
            "Cc: Copy <copy@example.com>\r\n",
            "Reply-To: reply@example.com\r\n",
            "Date: Fri, 23 Oct 2026 12:00:00 +0800\r\n",
            "Subject: =?UTF-8?B?5rWL6K+V?=\r\n",
            "Message-ID: <message@example.com>\r\n",
            "X-Empty:\r\n",
            "X-Unicode: 测试\r\n",
            "MIME-Version: 1.0\r\n",
            "Content-Type: text/plain; charset=utf-8\r\n",
            "Content-Transfer-Encoding: base64\r\n\r\n",
            "5q2j5paH"
        );
        let parsed = parse_message(raw);
        let headers: Vec<_> = parsed.headers.iter()
            .map(|header| (header.key.to_lowercase(), header.value.as_str()))
            .collect();
        assert_eq!(headers, vec![
            ("from".into(), "=?UTF-8?B?5rWL6K+V?=\r\n <first@example.com>"),
            ("from".into(), "Last <last@example.com>"),
            ("to".into(), "Team: one@example.com, two@example.com;"),
            ("cc".into(), "Copy <copy@example.com>"),
            ("reply-to".into(), "reply@example.com"),
            ("date".into(), "Fri, 23 Oct 2026 12:00:00 +0800"),
            ("subject".into(), "测试"),
            ("message-id".into(), "message@example.com"),
            ("x-empty".into(), ""),
            ("x-unicode".into(), "测试"),
            ("mime-version".into(), "1.0"),
            ("content-type".into(), "text/plain; charset=utf-8"),
            ("content-transfer-encoding".into(), "base64"),
        ]);
        assert_eq!(parsed.sender, "Last <last@example.com>");
        assert_eq!(parsed.subject, "测试");
        assert_eq!(parsed.text, "正文");
    }

    #[test]
    fn preserves_decoded_and_empty_text_headers() {
        let parsed = parse_message(concat!(
            "From: Sender <sender@example.com>\r\n",
            "Subject: =?UTF-8?B?5rWL6K+V?=\r\n =?UTF-8?B?5q2j5paH?=\r\n",
            "Subject: =?UTF-8?B?5rWL6K+V?=\r\n",
            "Comments: =?UTF-8?B?5rWL6K+V?=\r\n",
            "Content-Description: =?UTF-8?B?5rWL6K+V?=\r\n",
            "X-Label: =?UTF-8?B?5rWL6K+V?=\r\n",
            "X-Empty:\r\n\r\nBody"
        ));
        let headers: Vec<_> = parsed.headers.iter()
            .map(|header| (header.key.to_lowercase(), header.value.as_str()))
            .collect();
        assert_eq!(headers, vec![
            ("from".into(), "Sender <sender@example.com>"),
            ("subject".into(), "测试正文"),
            ("subject".into(), "测试"),
            ("comments".into(), "测试"),
            ("content-description".into(), "测试"),
            ("x-label".into(), "=?UTF-8?B?5rWL6K+V?="),
            ("x-empty".into(), ""),
        ]);
    }

    #[test]
    fn preserves_lf_headers_without_inventing_from() {
        for from in ["", "From:\n", "From: invalid\n"] {
            let raw = format!("{from}Subject: Plain\nContent-Type: text/plain\n\nBody");
            let parsed = parse_message(&raw);
            assert_eq!(parsed.subject, "Plain");
            assert_eq!(parsed.text, "Body");
            let exported: Vec<_> = parsed.headers.iter()
                .filter(|header| header.key.eq_ignore_ascii_case("from"))
                .map(|header| header.value.as_str())
                .collect();
            assert_eq!(exported, match from {
                "" => vec![],
                "From:\n" => vec![""],
                _ => vec!["invalid"],
            });
        }
    }
}
