use async_graphql::{
    ComplexObject, Context, EmptySubscription, Enum, Object, Result, Schema, SimpleObject,
};
use chrono::{DateTime, Local};
use rusqlite::Connection;
use std::path::PathBuf;
use uuid::Uuid;

use serde::{Deserialize, Serialize};

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
enum FileType {
    Pdf,
    Docx,
    Txt,
    Unknown,
}

#[derive(SimpleObject)]
#[graphql(complex)]
#[derive(Serialize, Deserialize)]
struct FileInfo {
    id: String,
    name: String,
    #[graphql(skip)]
    _created_date: DateTime<Local>,
    file_size: usize,
    // file_type: FileType,
}

#[ComplexObject]
impl FileInfo {
    async fn create_date(&self) -> String {
        self._created_date.to_rfc2822()
    }
}

pub struct Query;

#[Object]
impl Query {
    async fn list_files(&self, ctx: &Context<'_>) -> Result<Vec<FileInfo>> {
        let db_path = ctx.data::<PathBuf>()?;
        let conn = Connection::open(db_path)?;

        let mut stmt = conn.prepare("SELECT id, name, created_date, file_size from storage;")?;
        let res = stmt
            .query_map([], |row| {
                Ok(FileInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    _created_date: row.get(2)?,
                    file_size: row.get(3)?,
                })
            })?
            .map(|row| row.unwrap())
            .collect::<Vec<_>>();
        Ok(res)
    }

    async fn get_file(&self, ctx: &Context<'_>, id: String) -> Result<String> {
        let db_path = ctx.data::<PathBuf>()?;
        let conn = Connection::open(db_path)?;

        let mut stmt = conn.prepare("SELECT contents from storage WHERE id=:id;")?;

        let rows = stmt
            .query_map(&[(":id", &id)], |row| row.get::<_, Vec<u8>>(0))?
            .map(|row| row.unwrap())
            .collect::<Vec<_>>();
        let row = rows
            .get(0)
            .ok_or(format!("No file found for id = {}.", id))?;
        let contents = std::str::from_utf8(row)?;
        let encoded = base64::encode(contents);
        Ok(encoded)
    }
}

pub struct Mutation;

#[Object]
impl Mutation {
    async fn put_file(&self, ctx: &Context<'_>, name: String, contents: String) -> Result<String> {
        let contents = base64::decode(contents)?;

        let db_path = ctx.data::<PathBuf>()?;
        let conn = Connection::open(db_path)?;

        let uuid = Uuid::new_v4();

        conn.execute(
            "INSERT INTO storage (id, name, created_date, file_size, contents) values (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![&uuid.to_string(), &name, &Local::now(), &contents.len(), &contents]
        )?;

        Ok(uuid.to_string())
    }
}

#[allow(unused)]
pub type FileAPISchema = Schema<Query, Mutation, EmptySubscription>;
