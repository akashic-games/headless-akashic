class MainScene extends g.Scene {
  constructor(params) {
    super(params);
    this.onUpdate.add(this.handleUpdate, this);
    this.onMessage.add(this.handleMessageEvent, this);
    this.offsetTime = g.game.getCurrentTime();
    this.messageEvents = params.messageEvents;
    this._receivedMessageEvents = [];
  }

  handleUpdate() {
    const messageEvents = this.messageEvents;
    const nearestMessageEvent = messageEvents?.[0];

    if (!nearestMessageEvent?.length || g.game.isActiveInstance()) return;

    const nearestMessageEventOffsetTime = nearestMessageEvent[0];
    const offsetTime = g.game.getCurrentTime() - this.offsetTime;

    if (nearestMessageEventOffsetTime <= offsetTime) {
      const messageEvents = this.messageEvents.shift();
      const data = messageEvents[1];
      g.game.raiseEvent(new g.MessageEvent(data));
    }
  }

  handleMessageEvent(event) {
    if (g.game.isActiveInstance()) {
      this._receivedMessageEvents.push(event);
    }
  }

  getReceivedMessageEvents() {
    return this._receivedMessageEvents;
  }
}

module.exports = (args) => {
  const game = g.game;

  const scene = new MainScene({
    game,
    messageEvents: args.args?.messageEvents ?? [],
  });

  scene.onMessage.add(() => {
    g.game.vars.messageEvents = scene.getReceivedMessageEvents();
  });

  game.pushScene(scene);
};
