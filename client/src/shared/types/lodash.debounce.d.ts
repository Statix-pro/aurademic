declare module 'lodash.debounce' {
  interface DebouncedFunc<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
    flush(): ReturnType<T>;
  }
  const debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    immediate?: boolean,
  ) => DebouncedFunc<T>;
  export default debounce;
}
