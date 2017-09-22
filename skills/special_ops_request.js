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
        { id: "U0366QW3A", name: "cjlarose" },
        { id: "U03N3R7QX", name: "emj" },
        { id: "U035K9P2T", name: "ke" },
        { id: "U3GMFH23W", name: "quy" },
        { id: "U079X6QRJ", name: "robbie" },
        { id: "U035K9SMZ", name: "steveklebanoff" },
        { id: "U06BYM797", name: "zachmeyer" }
    ]
}

const botTestingChannel = {
    id: 'C10P91VS9',
    name: 'bot-testing',
    devsList: [
        { id: "U078EJBK2", name: "anthony" },
        // { id: "U0366QW3A", name: "cjlarose" },
        // { id: "U06BYM797", name: "zachmeyer" }
    ]
}

// TODO: Multi-channel support for on-call but not requests

module.exports = function(controller) {
    let onDutyDev = {};
    let hasDevAccepted = {};

    // workaround for weird team setup misbehavior
    controller.saveTeam(team_config, () => { console.log(`Setup team ${team_config.id}`)});

    setupChannel(botTestingChannel);

    controller.on('interactive_message_callback', (bot, message) => {
        if(message.callback_id === 'narwhal_assign') {
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
                begForOnCall(bot, message.channel);
            }
        }
    });

    controller.hears(['^!assign'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        hasDevAccepted[message.channel] = false;
        begForOnCall(bot, message.channel);
    });

    controller.hears(['^!request'], 'ambient,direct_message,direct_mention,mention', function(bot, message) {
        if(hasDevAccepted[message.channel] && onDutyDev[message.channel]) {
            requestPing = {
                text: `Paging Special Operator <@${onDutyDev[message.channel]}>!`,
                channel: message.channel
            }
            bot.say(requestPing);
        } else {
            bot.reply(message, {
                text: "Sorry, nobody has currently accepted on-call duty! :scream:\n I'll assign someone if you type `!assign` ."
            })
        }
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
                console.log(`Failed to get channel data for ${channelId}`)
                console.log(err)
            }
            let channelData = data
            let tempDutyList = channelData['dutyList']
            hasDevAccepted[channelId] = false

            dev = tempDutyList.shift();
            tempDutyList.push(dev);
            channelData['dutyList'] = tempDutyList

            controller.storage.channels.save(channelData, (err) => {
                console.log(err)
            });
            cb(dev, channelId);
        });
    }

    function begForOnCall(bot, channelId) {
        popDutyList(channelId, (dev, channelId) => {
            const message = {
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

            bot.sendEphemeral(message, (err, convo) => {
                if(err) {
                    console.log(err);
                }
            });
        });
    }
};
