const express = require("express")
const multer = require("multer")
// const { ENUM } = require("sequelize/types")
const LelangStatus = require("./lelang.enum")
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const CronJob = require('cron').CronJob;
const lelang = require("../models/index").lelang
const history_lelang = require("../models/index").history_lelang
const status = require('http-status');

const checkLastPrice = async(time,timestamp,id) => {
    let job = new CronJob(time, async () => {
            let result = await history_lelang.findAll({where:{id_lelang:id}})
            const data = []
            result.forEach(element => {
                data.push(element.dataValues)
            });
            result = await lelang.findOne({where:{id:id}})
            const {harga_akhir,id_masyarakat} = result.dataValues 
            const now = new Date().getTime()
            let max = harga_akhir,new_id_masyarakat = null,before = harga_akhir

            if(max > before){
                    await lelang.update({harga_akhir:max,id_masyarakat:new_id_masyarakat,status:LelangStatus.DITUTUP},{where:{id:id}})
            }
            if(data){
                data.forEach(e=>{
                    if(e.penawaran_harga > max){
                        max = e.penawaran_harga
                        new_id_masyarakat = e.id_masyarakat
                    }
                })
                
                if(!new_id_masyarakat){
                        new_id_masyarakat = id_masyarakat
                }
            }
    });      
    job.start()
}

app.put("/:id/start",async(req,res)=>{
    const resultLelang = await lelang.findOne({where:{id:req.params.id}}),temp = resultLelang.dataValues
    const now = new Date(),minutes = now.getTime()+120,{endTime} = req.body
    //hours = now.setHours(now.getHours() + 1)
    temp.status = LelangStatus.DIBUKA
    temp.tgl_lelang = now
    await lelang.update(temp,{where:{id:temp.id,endTime:endTime,tgl_lelang:now}})
    await checkLastPrice('*/30 * * * * *',minutes,temp.id) // cek and update lelang
    res.status(200).send("lelang started")
})

app.post("/bid", async (req, res) => {
    let current = new Date().toISOString().split('T')[0]
    const {id_lelang,id_masyarakat,penawaran_harga} = req.body
    const result = await lelang.findOne({where:{id:id_lelang}})
    const {harga_akhir,status} = result.dataValues
    const data = {
        id_lelang:id_lelang,
        id_masyarakat:id_masyarakat,
        penawaran_harga:penawaran_harga
    }

    if(status === LelangStatus.DITUTUP){
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
            error:"sorry,lelang belum dibuka atau sudah selesai",
            status: HttpStatus.BAD_REQUEST,
        })
    }

    if(harga_akhir > penawaran_harga){
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
            error:
            "sorry,penawaran harga kurang dari harga akhir!",
            status: HttpStatus.BAD_REQUEST,
        })
    }

    history_lelang.create(data)
    .then(result => {
        res.json({
            message: "Data berhasil ditambahkan",
            data: result
        })
    })
        .catch(error => {
            res.json({
                message: error.message
            })
        })

})


app.get("/", async (req, res) => {
    await lelang.findAll()
        .then(result => {
            res.json({
                data: result
            })
        })
        .catch(error => {
            res.json({
                message: error.message
            })
        })
})

app.get("/:id", async (req, res) => {
    const param = {
        id_lelang: req.params.id
    }
    await lelang.findOne({ where: param })
        .then(result => {
            res.json({
                data: result
            })
        }).catch(err => {
            res.json({
                message: err.message
            })
        })
})

app.post("/", async (req, res) => {
    const {id_barang,tgl_lelang,id_petugas} = req.body
    const result = await barang.findOne({where:{id:id_barang}}),{harga_awal} = result.dataValues
    let data = {
        id_barang: id_barang,
        tgl_lelang: current,
        harga_akhir: harga_awal,
        id_petugas: id_petugas,
        status: LelangStatus.DITUTUP
    }
    lelang.create(data)
    .then(result => {
        res.json({
            message: "Data berhasil ditambahkan",
            data: result
        })
    })
        .catch(error => {
            res.json({
                message: error.message
            })
        })

})

app.put("/", async (req, res) => {
    let param = {
        id_lelang: req.params.id_lelang
    }
    let data = {
        id_barang: req.body.id_barang,
        tgl_lelang: current,
        harga_akhir: req.body.harga_akhir,
        id_masyarakat: req.body.id_masyarakat,
        id_petugas: req.body.id_petugas,
        status: ENUM("dibuka", "ditutup")
    }
    lelang.update(data, { where: param })
        .then(result => {
            res.json({
                message: "Data has been Update",
                data: result
            })
        })
        .catch(error => {
            res.json({
                message: error.message
            })
        })
})

app.delete("/:id_lelang", async (req, res) => {
    let param = {
        id_lelang: req.params.id_lelang
    }
    lelang.destroy({ where: param })
        .then(result => {
            res.json({
                message: "Data has been Delete"
            })
        })
        .catch(error => {
            res.json({
                message: error.message
            })
        })
})
module.exports = {lelang:app,check:checkLastPrice}
