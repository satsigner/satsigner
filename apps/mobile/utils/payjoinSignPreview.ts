function shouldSuppressPayjoinTransactionChart(params: {
  negotiating: boolean
  signed: boolean
}): boolean {
  return params.negotiating && !params.signed
}

export { shouldSuppressPayjoinTransactionChart }
