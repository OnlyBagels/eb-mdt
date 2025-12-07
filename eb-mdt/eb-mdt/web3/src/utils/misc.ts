export const isEnvBrowser = (): boolean => !(window as any).invokeNative;

export const noop = () => {};

export const classNames = (
  ...classes: (string | undefined | null | false)[]
): string => {
  return classes.filter(Boolean).join(" ");
};
