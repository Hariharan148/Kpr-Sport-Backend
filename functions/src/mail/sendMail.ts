import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const Mailjet = require('node-mailjet');


admin.initializeApp();

const mailjet = new Mailjet({
  apiKey :"727bc250cbcfd76fca203c7976400c07",
  apiSecret : "f71a9adc1dc0b2fc49a8788f53b4c0ef"
});


export const checkAttendance = functions.pubsub.schedule('20 13 * * *').timeZone('Asia/Kolkata').onRun(async (context)  => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const studentEmails = new Map();

  const promises: Promise<any>[] = [];

  var studentDocId: string[] = [];

  console.log("hell");

  const attendanceQuerySnapshot = await admin.firestore().collection('attendance')
    .where('date', '==', today)
    .get();
  
  if (attendanceQuerySnapshot.docs.length > 0) {
    const attendanceDoc = attendanceQuerySnapshot.docs[0];
    console.log(attendanceDoc);
    
    const studentsQuerySnapshot = await attendanceDoc.ref.collection('students').get();

    studentsQuerySnapshot.forEach((studentDoc) => {
      const isAbsent = studentDoc.data().attendanceStatus === false;
      if(isAbsent){
        studentDocId.push(studentDoc.id)
      }
    });

    console.log(studentDocId);

const studentsCollectionRef = admin.firestore().collection('students');

  const matchingStudentsQuerySnapshot = await studentsCollectionRef.where(admin.firestore.FieldPath.documentId(), 'in', studentDocId).get();

  matchingStudentsQuerySnapshot.forEach((studentDoc) => {
    const emailInfo = {
      name: studentDoc.data().name,
      email: studentDoc.data().email,
      parentEmail: studentDoc.data().parentEmail
    };
    studentEmails.set(studentDoc.id, emailInfo);
  });


    for (const studentDocId of studentEmails.keys()) {
      const emailInfo = studentEmails.get(studentDocId);
  
      if (emailInfo) {
        const studentName = emailInfo.name;
        const studentEmail = emailInfo.email;
        const parentEmail = emailInfo.parentEmail;
  

            const documentRef = admin.firestore().collection("extras").doc("RjQ52abKy4v1yCa16nSD");
            let name;
            documentRef.get().then((doc) => {
              if (doc?.exists) {
                name = doc?.data()?.name;
                console.log(name);
              } else {
                console.log("No such document!");
              }
            }).catch((error) => {
              console.log("Error getting document:", error);
            });
  
            promises.push(mailjet.post('send', {'version': 'v3.1'}).request({
              'Messages': [{
                'From': {
                  'Email': 'kprsportapp@gmail.com',
                  'Name': `${name ? name : "KprSport"}`
                },
                'To': [
                  {
                    'Email': studentEmail,
                    'Name': studentName
                  },
                  {
                    'Email': parentEmail
                  }
                ],
                'Subject': 'Missed Sports Training',
                'TextPart': `Dear ${studentName},\n\nYou missed our sports training session today. Regular attendance is important for our team's success. Please let us know if we can support you in attending future sessions.\n\nBest regards,\n${name ? name : "KprSport"}`
              }]
            }));


      }
    }
  }
});
