.PHONY: sqlc generate clean

# Generate Go code from SQL queries using sqlc
sqlc:
	sqlc generate

# Alias for sqlc
generate: sqlc

# Remove generated db directory
clean:
	rm -rf db/
