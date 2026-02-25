package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	dbPath := `C:\Users\krist\AppData\Local\encore-build\rg93u\build\data\iam.db`

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Check migration version
	var version int
	err = db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Migration version: %d\n", version)

	// Check actual CREATE TABLE statement
	var createSQL string
	err = db.QueryRow("SELECT sql FROM sqlite_master WHERE type='table' AND name='subclients'").Scan(&createSQL)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("\nSubclients CREATE TABLE:\n%s\n\n", createSQL)

	// Check subclients table schema
	rows, err := db.Query("PRAGMA table_info(subclients)")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("\nSubclients table schema:")
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		err = rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("  %s: %s (NOT NULL: %d, PK: %d)\n", name, ctype, notnull, pk)
	}

	// Check indexes
	rows2, err := db.Query("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='subclients'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	fmt.Println("\nIndexes on subclients:")
	for rows2.Next() {
		var name, sql sql.NullString
		err = rows2.Scan(&name, &sql)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("  - %s: %s\n", name.String, sql.String)
	}

	// Check existing data
	rows3, err := db.Query("SELECT id, name, domain FROM subclients")
	if err != nil {
		log.Fatal(err)
	}
	defer rows3.Close()

	fmt.Println("\nExisting subclients:")
	count := 0
	for rows3.Next() {
		var id, name, domain string
		err = rows3.Scan(&id, &name, &domain)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("  - %s: %s (domain: '%s')\n", id, name, domain)
		count++
	}
	if count == 0 {
		fmt.Println("  (no data)")
	}
}
