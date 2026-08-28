# Declares the derivation as a build graph, not a tag lookup.
#   docker buildx bake runtime
#   docker buildx bake dev

target "runtime" {
  dockerfile = "Dockerfile"
  target     = "runtime"
  tags       = ["<APP>:runtime"]
}

target "dev" {
  dockerfile = "Dockerfile.dev"
  contexts   = { base = "target:runtime" }   # the dependency, declared
  tags       = ["<APP>:dev"]
}
