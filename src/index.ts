type Listener = (...args: any[]) => any;

type EventName = string | symbol;
type EventListener<F extends Listener = Listener> = { raw: F; wrap: F; context: object | null };
type Handler<F extends Listener = Listener> = Record<EventName, EventListener<F>[]>;

/**
 * 事件触发器，支持浏览器端和 node 端。
 *
 * @class
 * @example
 *
 * const emitter = new Emitter();
 *
 * // 注册监听方法
 * emitter.on('foo', () => console.log('foo 1'));
 * emitter.on('foo', () => console.log('foo 2'));
 *
 * // 触发方法
 * emitter.emit('foo');
 * // foo 1
 * // foo 2
 *
 * // 取消监听方法
 * emitter.off('foo');
 *
 * // 支持链式调用
 * emitter.on('foo', () => {})
 *  .on('foo', () => {})
 *  .off('foo');
 */
class EmitterPro<F extends Listener = Listener> {
  private handlers: Handler<F>;
  constructor() {
    this.handlers = {};
  }

  /**
   * 获取全部事件名称。
   *
   * @returns 事件名称数组。
   * @example
   * emitter.on('foo', () => {});
   * emitter.on('bar', () => {});
   *
   * emitter.eventNames(); // ['foo', 'bar']
   */
  eventNames() {
    const symbols = Object.getOwnPropertySymbols?.(this.handlers) || [];
    const keys = Object.keys(this.handlers) as (string | symbol)[];
    return keys.concat(symbols);
  }

  /**
   * 获取事件名称的全部监听方法（原始方法，未经过包装处理）。
   *
   * @param eventName 事件名称
   * @returns 对应事件名称的监听方法数组
   * @example
   * const fn1 = () => console.log('bar');
   * const fn2 = () => console.log('baz');
   *
   * emitter.on('test', fn1);
   * emitter.once('test', fn2);
   *
   * emitter.rawListeners('test'); // [fn1, fn2]
   */
  rawListeners(eventName: EventName) {
    const handler = this.handlers[eventName];
    return handler ? handler.map((item) => item.raw) : [];
  }

  /**
   * 获取事件名称的全部监听方法（如通过 `once` 方法注册，返回的是包装方法）。
   *
   * @param eventName 事件名称
   * @returns 对应事件名称的监听方法数组
   * @example
   * const fn1 = () => console.log('bar');
   * const fn2 = () => console.log('baz');
   *
   * emitter.on('test', fn1);
   * emitter.once('test', fn2);
   *
   * emitter.rawListeners('test'); // [fn1, wrapFn2]
   */
  listeners(eventName: EventName) {
    const handler = this.handlers[eventName];
    return handler ? handler.map((item) => item.wrap) : [];
  }

  /**
   * 判断事件名称对应的监听方法是否存在。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @returns 如果事件名称存在该事件方法返回 `true`，否则返回 `false`。
   * @example
   * const fn1 = () => console.log('bar');
   * const fn2 = () => console.log('baz');
   *
   * emitter.on('test', fn1);
   * emitter.once('test', fn2);
   *
   * emitter.hasListener('test', fn1); // true
   * emitter.hasListener('test', fn2); // true
   *
   * // fn2 是通过 once 方法注册，执行一次后自动解绑
   * emitter.emit('test');
   *
   * emitter.hasListener('test', fn1); // true
   * emitter.hasListener('test', fn2); // false
   */
  hasListener(eventName: EventName, listener: F) {
    return this.rawListeners(eventName).some((item) => item === listener);
  }

  private _on(
    eventName: EventName,
    raw: F,
    wrap: F,
    context: EventListener['context'] = null,
    dir = 1
  ) {
    const currentListener = { raw, wrap, context };

    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [currentListener];
    } else {
      const appendMethod = dir === 1 ? 'push' : 'unshift';
      this.handlers[eventName][appendMethod](currentListener);
    }

    return this;
  }

  /**
   * 注册监听方法。同 `on` 方法，只是将监听方法添加到最前面（事件触发是按顺序执行）。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @param context 执行上下文
   * @returns 事件触发器实例。
   * @example
   * emitter.on('foo', () => console.log('bar'));
   * emitter.prependListener('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // 42
   * // bar
   */
  prependListener(eventName: EventName, listener: F, context?: EventListener['context']) {
    return this._on(eventName, listener, listener, context, 0);
  }

  /**
   * 注册监听方法。允许多次添加同一引用的函数。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @param context 执行上下文
   * @returns 事件触发器实例。
   * @example
   * emitter.on('foo', () => console.log('bar'));
   * emitter.on('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // bar
   * // 42
   */
  on(eventName: EventName, listener: F, context?: EventListener['context']) {
    return this._on(eventName, listener, listener, context);
  }

  private _wrapOnce(eventName: EventName, listener: F, context: EventListener['context'] = null) {
    const wrap = ((...args: Parameters<F>) => {
      listener.apply(context, args);
      this.off(eventName, wrap);
    }) as F;
    return wrap;
  }

  /**
   * 仅触发一次的监听方法。使用方法同 `on` 。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @param context 执行上下文
   * @returns 事件触发器实例。
   * @example
   * emitter.on('foo', () => console.log('bar'));
   * emitter.once('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // bar
   * // 42
   *
   * emitter.emit('foo');
   * // bar
   */
  once(eventName: EventName, listener: F, context?: EventListener['context']) {
    const wrap = this._wrapOnce(eventName, listener, context);
    return this._on(eventName, listener, wrap, context);
  }

  /**
   * 仅触发一次的监听方法。同 `once` 方法，只是添加到最前面（事件触发是按顺序执行）。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @param context 执行上下文
   * @returns 事件触发器实例。
   * @example
   * emitter.on('foo', () => console.log('bar'));
   * emitter.prependOnceListener('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // 42
   * // bar
   *
   * emitter.emit('foo');
   * // bar
   */
  prependOnceListener(eventName: EventName, listener: F, context?: EventListener['context']) {
    const wrap = this._wrapOnce(eventName, listener, context);
    return this._on(eventName, listener, wrap, context, 0);
  }

  /**
   * 取消监听方法。如果不传第二个参数，将取消该事件名称的全部监听方法。如果多次添加同一引用的函数，需要多次删除。
   *
   * @param eventName 事件名称
   * @param listener 监听方法
   * @returns 事件触发器实例。
   * @example
   * const fn = () => console.log('bar');
   * emitter.on('foo', fn);
   * emitter.on('foo', () => console.log('baz'));
   * emitter.on('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // bar
   * // baz
   * // 42
   *
   * emitter.off('foo', fn); // 取消 foo 的监听方法 fn
   *
   * emitter.emit('foo');
   * // bar
   * // 42
   *
   * emitter.off('foo'); // 取消 foo 的全部监听方法
   * emitter.emit('foo'); // 什么都没发生
   */
  off(eventName: EventName, listener?: F) {
    const handler = this.handlers[eventName];

    if (handler) {
      if (listener) {
        const index = handler.findIndex((item) => item.wrap === listener || item.raw === listener);
        if (index !== -1) {
          handler.splice(index, 1);
        }
      } else {
        delete this.handlers[eventName];
      }
    }
    return this;
  }

  /**
   * 取消全部事件名称的监听方法。
   *
   * @returns 事件触发器实例。
   * @example
   * const fn = () => console.log('bar');
   * emitter.on('test', fn);
   * emitter.on('test', () => console.log('baz'));
   * emitter.on('test', () => console.log(42));
   *
   * emitter.on('other', fn);
   * emitter.on('other', () => console.log('baz'));
   *
   * emitter.emit('test');
   * // bar
   * // baz
   * // 42
   *
   * emitter.emit('other');
   * // bar
   * // baz
   *
   * emitter.offAll(); // 取消全部监听方法
   *
   * emitter.emit('test'); // 什么都没发生
   * emitter.emit('other'); // 什么都没发生
   */
  offAll() {
    this.handlers = {};
    return this;
  }

  /**
   * 触发监听方法。
   *
   * @param eventName 事件名称
   * @param args 触发监听方法的参数（从第二个参数开始都将传给监听方法）
   * @returns 如果触发成功返回 `true`，否则返回 `false`。
   * @example
   * emitter.on('foo', () => console.log('bar'));
   * emitter.on('foo', () => console.log(42));
   *
   * emitter.emit('foo');
   * // bar
   * // 42
   *
   * // 支持传入参数
   * emitter.on('test' (a, b) => console.log(a + b));
   * emitter.on('test' (a, b) => console.log(a * b));
   *
   * emitter.emit('other', 2, 5);
   * // 7
   * // 10
   *
   * emitter.emit('other', 5, 5);
   * // 10
   * // 25
   */
  emit(eventName: EventName, ...args: Parameters<F>) {
    const handler = this.handlers[eventName];
    if (handler && handler.length > 0) {
      handler.forEach((listener) => {
        listener.wrap.apply(listener.context, args);
      });
      return true;
    }
    return false;
  }
}

export default EmitterPro;
