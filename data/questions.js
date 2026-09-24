window.HAM_POOL = {
  meta: {
    title: "2026-2030 Technician Class",
    effective: "2026-07-01",
    expires: "2030-06-30",
    totalQuestions: 409,
    passingScore: 26,
    examLength: 35
  },
  sections: [
    {id:"T1",title:"Commission's Rules",groups:["T1A","T1B","T1C","T1D","T1E","T1F"]},
    {id:"T2",title:"Operating Procedures",groups:["T2A","T2B","T2C"]},
    {id:"T3",title:"Radio Wave Characteristics",groups:["T3A","T3B","T3C"]},
    {id:"T4",title:"Amateur Radio Practices",groups:["T4A","T4B"]},
    {id:"T5",title:"Electrical Principles",groups:["T5A","T5B","T5C","T5D"]},
    {id:"T6",title:"Electronic & Electrical Components",groups:["T6A","T6B","T6C","T6D"]},
    {id:"T7",title:"Practical Circuits",groups:["T7A","T7B","T7C","T7D"]},
    {id:"T8",title:"Signals & Emissions",groups:["T8A","T8B","T8C","T8D"]},
    {id:"T9",title:"Antennas & Feed Lines",groups:["T9A","T9B"]},
    {id:"T0",title:"Electrical & RF Safety",groups:["T0A","T0B","T0C"]}
  ],
  questions: [
    {id:"T1A01",group:"T1A",q:"Which of the following is part of the Basis and Purpose of the Amateur Radio Service?",a:["Providing personal radio communications for as many citizens as possible","Providing communications for international contesting","Advancing skills in the technical and communication phases of the radio art","All these choices are correct"],correct:2,explain:"Amateur radio exists in part to advance technical and communication skills."},
    {id:"T1A02",group:"T1A",q:"Which agency regulates and enforces the rules for the Amateur Radio Service in the United States?",a:["ARRL","Homeland Security","The FCC","All these choices are correct"],correct:2,explain:"The Federal Communications Commission (FCC) regulates U.S. amateur radio."},
    {id:"T1B03",group:"T1B",q:"Which frequency is in the 6-meter amateur band?",a:["49.00 MHz","52.525 MHz","28.50 MHz","222.15 MHz"],correct:1,explain:"52.525 MHz is inside the 6-meter amateur band."},
    {id:"T1B04",group:"T1B",q:"Which amateur band includes 146.52 MHz?",a:["6 meters","20 meters","70 centimeters","2 meters"],correct:3,explain:"146.52 MHz is the well-known national simplex calling frequency in the 2-meter band."},
    {id:"T1B11",group:"T1B",q:"What is the maximum peak envelope power output for Technician class operators in their HF band segments?",a:["200 watts","100 watts","50 watts","10 watts"],correct:0,explain:"Technician HF privileges are limited to 200 watts PEP."},
    {id:"T1C08",group:"T1C",q:"What is the normal term for an FCC-issued amateur radio license?",a:["Five years","Eight years","Ten years","Life"],correct:2,explain:"An FCC amateur radio license normally lasts 10 years."},
    {id:"T1C09",group:"T1C",q:"What is the grace period for renewal if an amateur license expires?",a:["Two years","Three years","Five years","Ten years"],correct:0,explain:"You have a two-year renewal grace period, but you may not transmit while the license is expired."},
    {id:"T1D06",group:"T1D",q:"What, if any, are the restrictions concerning transmission of language that may be considered indecent or obscene?",a:["The FCC maintains a list of prohibited words","Any such language is prohibited","The ITU maintains a prohibited list","There is no prohibition"],correct:1,explain:"Indecent or obscene language is prohibited."},
    {id:"T1E01",group:"T1E",q:"When may an amateur station transmit without a control operator?",a:["During automatic control","When another licensed amateur is present","When it is an auxiliary station","Never"],correct:3,explain:"A control operator is always required when an amateur station transmits."},
    {id:"T1E04",group:"T1E",q:"What determines the transmitting frequency privileges of an amateur station?",a:["The frequency coordinator","The frequencies printed on the license","The highest license held by anyone present","The license class held by the control operator"],correct:3,explain:"The control operator's license class determines the station's operating privileges."},
    {id:"T1F03",group:"T1F",q:"When are you required to transmit your assigned call sign?",a:["At the beginning and every 10 minutes","During every transmission","Every 15 minutes and at the end","At least every 10 minutes and at the end"],correct:3,explain:"Identify at least every 10 minutes during a communication and at the end."},
    {id:"T1F09",group:"T1F",q:"What type of amateur station simultaneously retransmits the signal of another amateur station on a different channel or channels?",a:["Beacon station","Remote control station","Repeater station","Message forwarding station"],correct:2,explain:"A repeater receives and retransmits on another channel."}
  ]
};