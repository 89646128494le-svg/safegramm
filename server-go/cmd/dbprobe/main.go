package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

type userRow struct {
	ID             string
	Username       string
	Email          sql.NullString
	Status         string
	Deleted        bool
	PassHash       string
	PassHashPrefix string
	PinHashLen     sql.NullInt64
}

func main() {
	username := flag.String("username", "", "username to inspect")
	email := flag.String("email", "", "email to inspect")
	password := flag.String("password", "", "password to compare against bcrypt hash")
	flag.Parse()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if *username == "" && *email == "" {
		log.Fatal("set --username or --email")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	query := `
select id,
       username,
       email,
       status,
       deleted_at is not null as deleted,
       pass_hash,
       left(pass_hash, 4) as pass_hash_prefix,
       length(pin_hash) as pin_hash_len
from users
where `
	args := []any{}
	if *username != "" {
		query += `lower(username) = lower($1)`
		args = append(args, *username)
	} else {
		query += `lower(email) = lower($1)`
		args = append(args, *email)
	}
	query += ` limit 1`

	var row userRow
	err = db.QueryRow(query, args...).Scan(
		&row.ID,
		&row.Username,
		&row.Email,
		&row.Status,
		&row.Deleted,
		&row.PassHash,
		&row.PassHashPrefix,
		&row.PinHashLen,
	)
	if err == sql.ErrNoRows {
		fmt.Println("NO_USER")
		return
	}
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("user=%s status=%s deleted=%v email_present=%v pass_hash_len=%d pass_hash_prefix=%s pin_hash_len=%d\n",
		row.Username,
		row.Status,
		row.Deleted,
		row.Email.Valid && row.Email.String != "",
		len(row.PassHash),
		row.PassHashPrefix,
		row.PinHashLen.Int64,
	)

	if *password != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(row.PassHash), []byte(*password)); err != nil {
			fmt.Println("PASSWORD_MATCH=false")
		} else {
			fmt.Println("PASSWORD_MATCH=true")
		}
	}
}
