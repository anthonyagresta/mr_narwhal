const util = require('util');
const _ = require('lodash');

// TODO: Round-robin to another developer after 2 requests?
// const ROUND_ROBIN = false;
// const ROUND_ROBIN_COUNT = 2;

// TODO: External config file for this stuff
const team_config = {
    "id": process.env.teamId,
    "name": process.env.teamName,
    "url": process.env.teamUrl,
    "bot":{
        "app_token": process.env.appToken,
        "user_id": process.env.botUserId,
        "name": process.env.botUsername,
        "token": process.env.token,
        "createdBy": process.env.createdByUser
    }
}

const specialOpsChannel = {
    id: 'C6UU136KF',
    name: 'mc-special-ops',
    devsList: [
        { id: "U078EJBK2", name: "anthony" },
        { id: "U04M992HL", name: "boster" },
        { id: "U0F52S742", name: "chad" },
        { id: "U035K9P2T", name: "ke" },
        { id: "U06BYUQD6", name: "lively" },
        { id: "U3GMFH23W", name: "quy" },
        { id: "U079X6QRJ", name: "robbie" },
        { id: "U035K9SMZ", name: "steveklebanoff" },
        { id: "U06BYM797", name: "zachmeyer" }
    ]
}

const ESCALATIONS = {
    id: "S3PP2NX6W",
    name: "escalations"
}

const botTestingChannel = {
    id: 'C10P91VS9',
    name: 'bot-testing',
    devsList: [
        { id: "U078EJBK2", name: "anthony" },
        // { id: "U03N3R7QX", name: "emj" },
        // { id: "U0366QW3A", name: "cjlarose" },
        // { id: "U06BYM797", name: "zachmeyer" }
    ]
}

const REQUEST_ONCALL_TIMEOUT = 300000;

// TODO: Multi-channel support for on-call but not requests

module.exports = function(controller) {
    let onDutyDev = {};
    let hasDevAccepted = {};

    // workaround for weird team setup misbehavior
    controller.saveTeam(team_config, () => { console.log(`Setup team ${team_config.id}`)});

    setupChannel(specialOpsChannel);
    setupChannel(botTestingChannel);

    controller.on('interactive_message_callback', (bot, message) => {
        if(message.callback_id === 'narwhal_assign') {
            if(hasDevAccepted[message.channel]) {
                // Someone else already accepted.
                // Probably timeout or extraneous "yes"
                // Just clear the button from their UI.
                bot.replyInteractive(message, {
                    text: ':timer_clock:',
                    attachments: []
                });
                return;
            }
            if(message.actions[0].value === 'yes') {
                onDutyDev[message.channel] = message.user;
                hasDevAccepted[message.channel] = true;
                const acceptMsg = {
                    text: `<@${message.user}> is on duty!\nIf you need something, type \`!request\` and I'll bother them.`,
                    channel: message.channel,
                }
                bot.replyInteractive(message, {
                    text: ':smile:'
                });
                bot.say(acceptMsg);
            } else {
                bot.replyInteractive(message, {
                    text: ':sad:'
                });
                begForOnCall(bot, message);
            }
        }
    });

    controller.hears(['^!assign'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        hasDevAccepted[message.channel] = false;
        begForOnCall(bot, message);
        setTimeout(assignTimeoutHandler, REQUEST_ONCALL_TIMEOUT, bot, message);
    });

    controller.hears(['^!request'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
        requestPing = {
            text: `Paging the Escalations Team <@${ESCALATIONS.name}>!`,
            channel: message.channel
        }
        bot.say(requestPing);
    });

    function setupChannel(channelStruct) {
    // Setup randomized list of whose turn it is!
        const dutyList = _.shuffle(channelStruct.devsList)
        let channelWithDutyList = channelStruct
        channelWithDutyList['dutyList'] = dutyList
        console.log(`Saving channel: ${util.inspect(channelWithDutyList, false, null)}`)

        controller.storage.channels.save(channelWithDutyList, (err) => {
            if(err) {
                console.log(err);
            }
        });
    }

    function popDutyList(channelId, cb) {
        controller.storage.channels.get(channelId, (err, data) => {
            if(err) {
                console.log(`Failed to get channel data for ${channelId}`);
                console.log(err);
            }
            let channelData = data
            let tempDutyList = channelData['dutyList']
            hasDevAccepted[channelId] = false

            dev = tempDutyList.shift();
            tempDutyList.push(dev);
            channelData['dutyList'] = tempDutyList

            controller.storage.channels.save(channelData, (err) => {
                if(err) {
                    console.log(err);
                }
            });
            cb(dev, channelId);
        });
    }

    function assignTimeoutHandler(bot, message) {
        if(!hasDevAccepted[message.channel]) {
            if(message.retryCount) {
                if(message.retryCount < 5) {
                    message.retryCount = message.retryCount + 1;
                } else {
                    const retryMsg = {
                        as_user: true,
                        user: message.user,
                        channel: message.channel,
                        text: `Too many retries, giving up.`
                    };

                    bot.sendEphemeral(retryMsg, (err, convo) => {
                        if(err) {
                            console.log(err);
                        }
                    });
                    return;
                }
            } else {
                message.retryCount = 1;
            }
            const retryMsg = {
                as_user: true,
                user: message.user,
                channel: message.channel,
                text: 'Timed out, asking someone else...'
            };

            bot.sendEphemeral(retryMsg, (err, convo) => {
                if(err) {
                    console.log(err);
                }
            });

            begForOnCall(bot, message);
            setTimeout(assignTimeoutHandler, REQUEST_ONCALL_TIMEOUT, bot, message);
        }
    }

    function begForOnCall(bot, message) {
        popDutyList(message.channel, (dev, channelId) => {
            const askMessage = {
                as_user: true,
                user: dev.id,
                channel: channelId,
                text: `Hey, <@${dev.id}>! Can you be on-call for today?`,
                attachments: [
                    {
                        "fallback": "You need a real Slack client to answer this...",
                        "callback_id": "narwhal_assign",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "actions": [
                            {
                                "name": "choice",
                                "text": "Yeah!",
                                "type": "button",
                                "value": "yes"
                            },
                            {
                                "name": "choice",
                                "text": "I'm busy...",
                                "type": "button",
                                "value": "no"
                            }
                       ]
                    }
                ]
            };

            bot.sendEphemeral(askMessage, (err, convo) => {
                if(err) {
                    console.log(err);
                }
            });

            const iSentItMsg = {
                as_user: true,
                user: message.user,
                channel: message.channel,
                text: `Sent on-call request to <@${dev.id}>`
            };

            bot.sendEphemeral(iSentItMsg, (err, convo) => {
                if(err) {
                    console.log(err);
                }
            });
        });
    }
};
