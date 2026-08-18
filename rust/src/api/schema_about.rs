use async_graphql::{Object, SimpleObject};
use serde::Deserialize;
use std::path::PathBuf;

// Static content is embedded at compile time from the root `data/` directory so it
// is always available inside the binary, regardless of the deployment layout (this
// fixes the empty About/Changelog/Features sections when running inside the Docker
// image, where the `data/` directory is not present on disk). At runtime we still
// try to read the file from disk first so local development can hot-swap the JSON
// without rebuilding.
const EMBEDDED_ABOUT: &str = include_str!("../../../data/about.json");
const EMBEDDED_FEATURES: &str = include_str!("../../../data/features.json");
const EMBEDDED_CHANGELOG: &str = include_str!("../../../data/changelog.json");

#[derive(Debug, SimpleObject)]
pub struct AboutInfoOutput {
    pub description: String,
}

#[derive(Debug, SimpleObject)]
pub struct FeatureOutput {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, SimpleObject)]
pub struct ChangelogChangeOutput {
    #[graphql(name = "type")]
    pub change_type: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, SimpleObject)]
pub struct ChangelogReleaseOutput {
    pub version: String,
    pub date: String,
    pub changes: Vec<ChangelogChangeOutput>,
}

#[derive(Default)]
pub struct AboutQuery;

fn get_data_path(filename: &str) -> PathBuf {
    let bin_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let base = bin_dir
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent());

    if let Some(base_path) = base {
        let path = base_path.join("data").join(filename);
        if path.exists() {
            return path;
        }
    }

    PathBuf::from("data").join(filename)
}

fn read_json_file<T: for<'de> Deserialize<'de>>(filename: &str) -> Option<T> {
    // Prefer the on-disk file (allows local dev hot-swap), then fall back to the
    // compile-time-embedded copy so the data is always present in container images.
    let path = get_data_path(filename);
    if let Some(content) = std::fs::read_to_string(&path)
        .ok()
        .filter(|c| !c.trim().is_empty())
        && let Ok(parsed) = serde_json::from_str::<T>(&content)
    {
        return Some(parsed);
    }

    let embedded = match filename {
        "about.json" => EMBEDDED_ABOUT,
        "features.json" => EMBEDDED_FEATURES,
        "changelog.json" => EMBEDDED_CHANGELOG,
        _ => return None,
    };
    serde_json::from_str::<T>(embedded).ok()
}

#[Object]
impl AboutQuery {
    async fn about_info(&self) -> Option<AboutInfoOutput> {
        #[derive(Deserialize)]
        struct AboutJson {
            description: String,
        }

        let data: Option<AboutJson> = read_json_file("about.json");
        data.map(|d| AboutInfoOutput {
            description: d.description,
        })
    }

    async fn features(&self) -> Vec<FeatureOutput> {
        #[derive(Deserialize)]
        struct FeaturesJson {
            features: Vec<FeatureJson>,
        }

        #[derive(Deserialize)]
        struct FeatureJson {
            id: String,
            title: String,
            description: String,
        }

        let data: Option<FeaturesJson> = read_json_file("features.json");
        data.map(|d| {
            d.features
                .into_iter()
                .map(|f| FeatureOutput {
                    id: f.id,
                    title: f.title,
                    description: f.description,
                })
                .collect()
        })
        .unwrap_or_default()
    }

    async fn changelog(&self) -> Vec<ChangelogReleaseOutput> {
        #[derive(Deserialize)]
        struct ChangelogJson {
            releases: Vec<ReleaseJson>,
        }

        #[derive(Deserialize)]
        struct ReleaseJson {
            version: String,
            date: String,
            changes: Vec<ChangeJson>,
        }

        #[derive(Deserialize)]
        struct ChangeJson {
            #[serde(rename = "type")]
            change_type: String,
            title: String,
            description: String,
        }

        let data: Option<ChangelogJson> = read_json_file("changelog.json");
        data.map(|d| {
            d.releases
                .into_iter()
                .map(|r| ChangelogReleaseOutput {
                    version: r.version,
                    date: r.date,
                    changes: r
                        .changes
                        .into_iter()
                        .map(|c| ChangelogChangeOutput {
                            change_type: c.change_type,
                            title: c.title,
                            description: c.description,
                        })
                        .collect(),
                })
                .collect()
        })
        .unwrap_or_default()
    }
}
