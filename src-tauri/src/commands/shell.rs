//! Native shell integration commands. Each delegates to the OS's standard
//! reveal/open mechanism via `std::process::Command` rather than pulling
//! in another Tauri plugin.

use crate::error::{NotorError, Result};
use std::path::Path;
use std::process::Command;

fn ensure_exists(path: &str) -> Result<()> {
    if Path::new(path).exists() {
        Ok(())
    } else {
        Err(NotorError::NotFound(path.into()))
    }
}

#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<()> {
    ensure_exists(&path)?;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(NotorError::Io)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(NotorError::Io)?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // No portable "reveal" on Linux; open the containing directory.
        let parent = Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path.clone());
        Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(NotorError::Io)?;
        Ok(())
    }
}

#[tauri::command]
pub async fn open_externally(path: String) -> Result<()> {
    ensure_exists(&path)?;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(NotorError::Io)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(NotorError::Io)?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(NotorError::Io)?;
        Ok(())
    }
}
