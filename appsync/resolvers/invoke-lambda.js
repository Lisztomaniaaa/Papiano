export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      info: { typeName: ctx.info.parentTypeName, fieldName: ctx.info.fieldName },
      arguments: ctx.arguments,
      identity: ctx.identity,
    },
  };
}

export function response(ctx) {
  return ctx.result;
}
