# RECHTSKLAR – Interaktiver Lernkurs zu Rechtsgeschäften

Ein browserbasierter, mobil nutzbarer Lernkurs mit **Willenserklärungen**, **Arten von Rechtsgeschäften** und **Formvorschriften**. Inhaltliche Grundlage sind die beiden von der Lehrkraft bereitgestellten PDFs (Skript und Übungen mit Lösungen). Fehlerhafte oder zu pauschale ältere Musterlösungen wurden differenziert bzw. anhand der einschlägigen Gesetze korrigiert. Die vollständige Übersicht steht in `KORREKTUREN_UND_ABDECKUNG.md`.

## Schnellstart: ZIP → GitHub → Netlify

**Wichtig:** GitHub soll die **entpackten Dateien** enthalten. Laden Sie nicht lediglich die ZIP als eine Datei in das Repository.

1. **ZIP entpacken.** Ein neues, möglichst privates GitHub-Repository erstellen; die **Inhalte des Ordners** (`package.json`, `netlify.toml`, `src`, `netlify` usw.) in das Repository hochladen. Achten Sie darauf, dass `package.json` im Repository-Stamm liegt.
2. Im **Netlify-Dashboard** unter **Add new project → Import an existing project** GitHub verbinden und das angelegte Repository auswählen.
3. Im Netlify-Projekt unter **Site configuration → Environment variables** eine Variable mit dem exakten Namen `LEHRER_SETUP_CODE` anlegen. Als Wert **einen eigenen zufällig erzeugten, geheimen Code mit mindestens 12 Zeichen** vergeben, möglichst deutlich länger. **Nicht** in GitHub ablegen oder in `.env.example` eintragen. Sie benötigen **keine** `AUTH`-Variable und **keine** Datenbank bei Supabase.
4. Für die Build-Einstellungen `npm run build` und Publish-Verzeichnis `dist` verwenden. Diese Werte sind in der `netlify.toml` bereits definiert; die Netlify Functions werden automatisch aus `netlify/functions` eingebunden. Node.js 22 ist konfiguriert. Projekt deployen bzw. nach Änderung von Umgebungsvariablen erneut deployen.
5. Die auf Netlify angezeigte Website aufrufen. Unter **Anmelden → Registrieren → Lehrkraft** Klasse (z. B. `BG12A`), selbstgewählten Nicknamen, sicheres Passwort und den Netlify-Lehrkraft-Code eingeben. Damit wird die Klasse angelegt. Sie können für weitere Klassen zusätzliche Lehrkraftkonten anlegen; der Code ist derselbe, bis Sie ihn in Netlify ändern.
6. Erst danach können sich Schülerinnen und Schüler mit **derselben Klassenbezeichnung**, einem **eigenen Nicknamen** und einem **eigenen Passwort** für diese Klasse registrieren. Die Klassennamen werden bei der Zuordnung ohne Unterschied von Groß-/Kleinschreibung behandelt. Ohne Konto ist ein sofortiger Gastzugang möglich.
7. Nach dem Einrichten der Konten den **Lehrerbereich** öffnen. Dort gibt es den Fortschrittsüberblick pro Klasse, individuelle Antworten, Reset aller Lernstände einer Klasse oder einzelner Konten, Löschung von Schülerkonten und Erzeugung eines temporären Passworts.

**Hinweis zur Lehrkraft-Anmeldung:** Der Code wird zur **erstmaligen Registrierung** eines Lehrkraftkontos eingegeben. Für die spätere Anmeldung sind nur Klasse, Nickname und Passwort erforderlich. `LEHRER_SETUP_CODE` bleibt eine **serverseitige Netlify-Umgebungsvariable**; er wird nicht an den Browser ausgeliefert.

## Aufbau und Bedienung

- 3 Kapitel mit 9 Unterkapiteln, **61 regulären bzw. Bonusübungen** und **12 Fragen im Abschlusstest**, alle drei Anforderungsbereiche in jedem Unterkapitel. Definitionslastige Teile haben jeweils nur fünf Übungen; anspruchsvollere Fallkapitel mehr. Ähnliche Originalfälle sind in Sammelzuordnungen gebündelt.
- **Alle Übungs- und Testaufgaben erscheinen untereinander**, ohne eine einzelne Aufgabe anklicken zu müssen. Jede Aufgabe kann unmittelbar geprüft werden.
- Zahlreiche Fallbeispiele und originale Aufgabenstellungen in didaktisch geeigneter, ggf. berichtigter Fassung. Aufgabentypen: Single Choice, Multiple Choice, Richtig/Falsch, Zuordnung mit Drag-and-drop oder Touch-Auswahl, Reihenfolge, Lückentext und selbstbeurteilte Freitextantworten.
- Die Lernenden müssen das Aufrufen der **Musterlösung explizit bestätigen**. Bei längeren Freitexten müssen sie die Musterlösung mit ihrer Antwort vergleichen und können die Aufgabe danach selbst als richtig markieren oder überarbeiten.
- Interaktive Schaubilder, z. B. die Preisregler-Demonstration zu **Antrag und Annahme** und ein Entscheidungsbaum zu Formmängeln. Alle Erklärungen benutzen die **Sie-Form**.
- XP, Level, Fortschrittsbalken, Erfolge und Bonusaufgaben sowie ein Avatar-Shop mit **Haustieren, Outfits und Hintergründen** und einer Avatar-Galerie. Im eingeloggten Modus erfolgt die XP-Vergabe für objektive Aufgaben serverseitig.
- Browserinterner Lernstand im Gastmodus und **geräteübergreifende Speicherung** bei Anmeldung.
- Im Profil oder Footer lässt sich ein **zusammenhängendes Lernportfolio als PDF** mit allen bereits eingegebenen Antworten und Begründungen erzeugen. Für den Export wird `jsPDF` im Browser verwendet; der Server benötigt dafür keinen PDF-Dienst.
- Neun reversible Kompetenz-Selbsteinschätzungen von 1 bis 5, sortiert nach „Noch offen“ und „Erledigt“.

## Architektur und Datenschutz

- **Frontend:** Vite, Vanilla JavaScript, responsives CSS, Lucide-Icons, generierte SVG-Schaubilder.
- **Server:** eine Netlify Function unter `/api/:action`; Speicherung der Klassen, Nutzerkonten, Lernstände, Authentifizierungssitzungen und Anmeldeversuch-Beschränkungen in **Netlify Blobs**. Kein Supabase, kein SQL-Editor und kein allgemeiner `AUTH`-Schlüssel.
- **Passwörter:** gesalzenes `scrypt`-Hashing, keine Passwort-Klartexte in der Datenbank. Sitzungscookies: `HttpOnly`, `Secure`, `SameSite=Lax`. Ein Passwort-Reset macht ältere Sitzungen ungültig.
- **Zugriffskontrolle:** Lehrer können nur Schülerkonten ihrer eigenen Klasse sehen oder bearbeiten. Die Zuordnung wird serverseitig geprüft. Bei objektiv prüfbaren Aufgaben wird die Musterlösung **serverseitig** verglichen; XP lassen sich nicht durch bloßes Ändern eines Browserwerts gutschreiben.
- **Gastmodus:** Inhalte und Fortschritt liegen nur im `localStorage` des verwendeten Browsers. Bei Anmeldung werden bestehende Antworten möglichst in das Benutzerkonto übernommen; Ergebnisse werden serverseitig erneut überprüft.
- **Nutzerdaten:** Klassenbezeichnung, Nickname, gesalzener Passwort-Hash, Antworten/Begründungen, XP, Käufe, Selbstcheck und Sitzungsdaten. Es werden keine E-Mail-Adressen abgefragt.

### Wichtig für den schulischen Produktiveinsatz

Dies ist eine **Anwendungsvorlage**, kein automatisch datenschutzrechtlich freigegebener Schuldienst. Vor Verwendung mit echten Lernenden sind datenschutzrechtliche Voraussetzungen (DSGVO, Datenverarbeitung mit Netlify, Speicherort, Aufbewahrungs-/Löschkonzept, schulische Einwilligungs- oder Rechtsgrundlage, ggf. AV-Vertrag) und schulinterne Freigaben zu prüfen. Für Lernende empfehlen sich pseudonyme Nicknamen. Der Lehrkraft-Code muss geheim bleiben und sollte bei Verdacht auf Weitergabe im Netlify-Dashboard geändert werden. Für Datenschutzanforderungen kann eine regionale Netlify-Blobs-Konfiguration erforderlich sein; die voreingestellte Anbindung nutzt die Standardkonfiguration von Netlify. Prüfen Sie vor dem Einsatz die aktuell von Netlify bereitgestellten Regionen und Bedingungen.

Der eingebundene Bildausschnitt eines Rollers stammt aus dem **hochgeladenen Ausgangsmaterial**. Vor öffentlicher Veröffentlichung sind die Nutzungsrechte an diesem Originalbild zu klären; entfernen oder ersetzen Sie gegebenenfalls `public/assets/simson-fall.png` und die Bildreferenz in `src/main.js`. Weitere Grafiken und Icons sind programmatisch dargestellt.

## Tests und Entwicklung

Nach Installation von Node.js 22:

```bash
npm install
npm run check:all
npm run build
```

Für die lokale Frontend-Entwicklung:

```bash
npm run dev
```

Der reine lokale Vite-Server ermöglicht den **Gastmodus**. Serverkonten benötigen eine Netlify-Function-Umgebung mit gültigem Blobs-Kontext, zum Beispiel **Netlify Dev** oder die deployte Website.

Die beigefügte Prüfung `npm run check:all` validiert unter anderem Aufgaben-IDs, AFB-Zuordnung, Vorhandensein von Musterlösungen und die Richtigkeit automatisch auswertbarer Antworten. Die **Serverlogik** wurde mit einer lokalen Test-Doubles-Datenbank auf Registrierung, Login, Klassenzuordnung, Fortschritt, XP, Passwort-Reset und Konto-/Datenlöschung überprüft.

**Einschränkung der vorliegenden ZIP-Erstellung:** Ein vollständiger `npm install`/Vite-Produktions-Build und ein Live-Netlify-Deployment waren in der Erstellungsumgebung mangels Paketdownload/externem Deployment nicht ausführbar. Die Aufgabenbank und die gestapelte Übungsansicht wurden jedoch mit den enthaltenen Node-Testskripten geprüft. Prüfen Sie deshalb den ersten Netlify-Build und den realen Kontenworkflow anhand der dortigen Deploy- und Function-Logs. Die ZIP enthält den vollständigen Quellcode, nicht vorab gebaute `dist`-Dateien. Ein grüner Build auf Netlify ist noch keine Datenschutzfreigabe.

## Inhaltliche Quellen

1. Von der Lehrkraft bereitgestelltes PDF `Willenserkl. und Formvorschr._2021_Skript.pdf`.
2. Von der Lehrkraft bereitgestelltes PDF `Willenserkl. und Formvorschr._2021_Übungen_ges_Lös.pdf`.
3. Einschlägige Vorschriften des [BGB](https://www.gesetze-im-internet.de/bgb/), des [BBiG](https://www.gesetze-im-internet.de/bbig_2005/) und des [HGB](https://www.gesetze-im-internet.de/hgb/). Gesetzeslinks sind zusätzlich im Glossar der Anwendung enthalten.

Die Ausgangs-PDFs selbst sind aus urheber- und datensparsamen Gründen nicht Teil des GitHub-Repositorys.

## KI-Nachweis

Der gesetzte Hinweis im Footer nennt **05.11.2026** und **ChatGPT (GPT-6)** und weist korrekt darauf hin, dass die **abschließende fachliche und redaktionelle Kontrolle durch die Lehrkraft vor dem Einsatz** noch stattfinden muss. Bitte passen Sie diesen Text nach Ihrer tatsächlichen Schlusskontrolle gegebenenfalls an.

## Aktualisierung: kompakte Lernfassung

Die ursprüngliche Lernfassung hatte 124 Übungen. Diese überarbeitete Fassung hat **61 Übungen** sowie die unveränderten 12 Fragen des Abschlusstests. Fünf Übungen je definitorischem Einstiegsabschnitt, mehr Fallaufgaben bei Vertragsabschluss und Formmängeln. Inhaltliche Dopplungen wurden gestrichen oder zusammengelegt; eine Auswahl der ursprünglichen PDF-Aufgaben ist in Sammelzuordnungen integriert. Die Datei `KORREKTUREN_UND_ABDECKUNG.md` dokumentiert die fachliche Korrektur der Originalmaterialien.

In jedem Unterkapitel (und auch im Abschlusstest) stehen die Aufgaben **vollständig direkt untereinander**; es gibt keine separate nummerierte Aufgaben-Navigation. Die Eingaben werden weiterhin pro Aufgabe geprüft und gespeichert. Beim Prüfen und Öffnen von Musterlösungen bleibt die jeweilige Aufgabe an ihrer Bildschirmposition.
