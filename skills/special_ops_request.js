const util = require('util');
const _ = require('lodash');

// TODO: Round-robin to another developer after 2?
// const ROUND_ROBIN = false;
// const ROUND_ROBIN_COUNT = 2;

// TODO: External config file for this
const special_ops_channel = {
    id: 'C6UU136KF',
    name: 'mc-special-ops',
    devs_list: [
        { id: "U078EJBK2", name: "anthony" }//,
        // { id: "U04M992HL", name: "boster" },
        // { id: "U0F52S742", name: "chad" },
        // { id: "U0366QW3A", name: "cjlarose" },
        // { id: "U03N3R7QX", name: "emj" },
        // { id: "U035K9P2T", name: "ke" },
        // { id: "U3GMFH23W", name: "quy" },
        // { id: "U035K9SMZ", name: "steveklebanoff" },
        // { id: "U06BYM797", name: "zachmeyer" }
    ]
}

// TODO: Multi-channel support for on-call but not requests

module.exports = function(controller) {

    // Setup randomized list of whose turn it is!
    const duty_list = _.shuffle(special_ops_channel.devs_list)
    let channel_with_duty_list = special_ops_channel
    channel_with_duty_list['duty_list'] = duty_list

    let on_duty_dev = null;
    let has_dev_accepted = false;

    controller.storage.channels.save(channel_with_duty_list, (err) => {
        if(err) {
            console.log(err)
        }
    });

    controller.on('interactive_message_callback', (bot, message) => {
        if(message.callback_id === 'narwhal_assign_mc-special-ops') {
            if(message.actions[0].value === 'yes') {
                on_duty_dev = message.user;
                has_dev_accepted = true;
                bot.api.channels.setTopic({ "topic": `<@${message.user}> is on duty!`}, (err,data) => {
                    if(err) {
                        console.log(err)
                    }
                })
                bot.replyInteractive(message, {
                    text: ':smile:'
                });
            } else {
                bot.replyInteractive(message, {
                    text: ':sad:'
                });
                begForOnCall(bot);
            }

        }
    });

    controller.hears(['^!assign'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        has_dev_accepted = false;
        begForOnCall(bot);
    });

    controller.hears(['^!request'], 'ambient,direct_message,direct_mention', function(bot, message) {
        bot.startConversation(message, function(err, convo) {
        convo.addMessage("Done.")
        convo.next();
        });
    });

    function begForOnCall(bot) {
        controller.storage.channels.get(special_ops_channel.id, (err, data) => {
            if(err) {
                console.log(err)
            }
            let channel_data = data
            let temp_duty_list = channel_data['duty_list']
            has_dev_accepted = false

            dev = temp_duty_list.shift();
            temp_duty_list.push(dev);
            channel_data['duty_list'] = temp_duty_list

            controller.storage.channels.save(channel_data, (err) => {
                console.log(err)
            })

            const message = {
                as_user: true,
                user: dev.id,
                channel: channel_data.id,
                text: `Hey, <@${dev.id}>! Can you be on-call for today?`,
                attachments: [
                    {
                        "fallback": "You need a real Slack client to answer this...",
                        "callback_id": "narwhal_assign_mc-special-ops",
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
