@app
clips-app-e268

@aws
policies
  arn:aws:iam::872511653058:policy/clips_store_full_access_policy-94f4bdb
  architect-default-policies

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
