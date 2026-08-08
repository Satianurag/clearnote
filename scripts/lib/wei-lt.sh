# Compare two wei amounts without bc: wei_lt <value> <threshold>
wei_lt() {
  awk -v a="${1:-0}" -v b="${2:-0}" 'BEGIN{exit !(a < b)}'
}
