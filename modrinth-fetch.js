/**
 * MC Stats – Modrinth Fetcher
 * 
 * Nutzung:
 *   node modrinth-fetch.js <dein-modrinth-name>
 * 
 * Beispiel:
 *   node modrinth-fetch.js Notch
 * 
 * Das Script erstellt eine "modrinth-data.json" im gleichen Ordner.
 * Diese JSON kannst du dann in die mc-stats.html ziehen.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const username = process.argv[2];

if (!username) {
  console.error('❌  Bitte gib deinen Modrinth-Namen an:');
  console.error('   node modrinth-fetch.js DeinName');
  process.exit(1);
}

// Hilfsfunktion: HTTPS GET → JSON
function get(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'mc-stats-fetcher/1.0 (github.com/mc-stats)',
      },
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON Parse Error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

async function main() {
  console.log(`\n🔍  Lade Modrinth-Profil für "${username}"...\n`);

  // 1. User laden
  let user;
  try {
    user = await get(`https://api.modrinth.com/v2/user/${encodeURIComponent(username)}`);
  } catch (e) {
    console.error('❌  Nutzer nicht gefunden:', e.message);
    process.exit(1);
  }

  if (user.error) {
    console.error('❌  Modrinth-Fehler:', user.description || user.error);
    process.exit(1);
  }

  console.log(`✅  Nutzer gefunden: ${user.username}`);
  if (user.bio) console.log(`    Bio: ${user.bio}`);

  // 2. Projekte laden
  const projects = await get(`https://api.modrinth.com/v2/user/${user.id}/projects`);
  console.log(`✅  ${projects.length} Projekte geladen`);

  // 3. Stats berechnen
  const totalDownloads = projects.reduce((s, p) => s + (p.downloads || 0), 0);
  const totalFollowers = projects.reduce((s, p) => s + (p.followers || 0), 0);

  console.log(`\n📊  Stats:`);
  console.log(`    Projekte:  ${projects.length}`);
  console.log(`    Downloads: ${fmtNum(totalDownloads)}`);
  console.log(`    Follower:  ${fmtNum(totalFollowers)}`);

  if (projects.length > 0) {
    console.log(`\n📦  Projekte:`);
    projects.forEach(p => {
      console.log(`    • ${p.title.padEnd(30)} ⬇ ${fmtNum(p.downloads).padStart(6)}   ♥ ${p.followers}`);
    });
  }

  // 4. JSON generieren
  const output = {
    // Meta
    _fetched_at: new Date().toISOString(),
    _username:   username,

    // User
    user: {
      id:         user.id,
      username:   user.username,
      avatar_url: user.avatar_url || '',
      bio:        user.bio || '',
      role:       user.role || 'member',
      created:    user.created || '',
    },

    // Projekte (alle Felder)
    projects: projects.map(p => ({
      id:           p.id,
      slug:         p.slug,
      title:        p.title,
      description:  p.description,
      icon_url:     p.icon_url || '',
      project_type: p.project_type,
      downloads:    p.downloads || 0,
      followers:    p.followers || 0,
      categories:   p.categories || [],
      versions:     p.versions || [],
      date_created: p.published || '',
      date_modified:p.updated || '',
      status:       p.status || '',
      client_side:  p.client_side || '',
      server_side:  p.server_side || '',
      game_versions:p.game_versions || [],
      loaders:      p.loaders || [],
    })),

    // Zusammenfassung für mc-stats.html
    summary: {
      total_projects:  projects.length,
      total_downloads: totalDownloads,
      total_followers: totalFollowers,
      project_types:   [...new Set(projects.map(p => p.project_type))],
      loaders:         [...new Set(projects.flatMap(p => p.loaders || []))],
    },
  };

  const outPath = path.join(process.cwd(), 'modrinth-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅  Gespeichert: ${outPath}`);
  console.log(`\n👉  Zieh die "modrinth-data.json" in das Modrinth-Panel der mc-stats.html!`);
}

main().catch(err => {
  console.error('❌  Fehler:', err.message);
  process.exit(1);
});
