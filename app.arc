@app
clips-app-e268

@aws
policies
  arn:aws:iam::aws:policy/AmazonS3FullAccess

@http
/*
  method any
  src server

@static

@tables
user
  pk *String

password
  pk *String # userId

note
  pk *String  # userId
  sk **String # noteId
